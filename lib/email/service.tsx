import React from 'react'
import { Resend } from 'resend'
import { validate as uuidValidate } from 'uuid'
import { getResend } from './resend-client'
import { renderEmailTemplate, isValidEmail } from './utils'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { logger, maskEmail } from '@/lib/utils'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hello@thelacrosselab.com'

// Audience ID for adding contacts to audience when creating them
// TODO: Move to environment variable
export const RESEND_AUDIENCE_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf'

// Validate audience ID is a valid UUID
if (!uuidValidate(RESEND_AUDIENCE_ID)) {
  throw new Error(`Invalid RESEND_AUDIENCE_ID: "${RESEND_AUDIENCE_ID}" is not a valid UUID`)
}

/**
 * Type for Resend email send response
 * Resend SDK v4.0.0 returns { data: { id: string } | null, error: any }
 */
type ResendEmailResponse = {
  data: { id: string } | null
  error: any
}

/**
 * Retry configuration for email sends
 */
interface RetryOptions {
  attempts: number
  baseDelayMs: number
  timeoutMs: number
}

/**
 * Send email with retry and exponential backoff
 */
async function sendWithRetry(
  email: string,
  payload: Parameters<Awaited<ReturnType<typeof getResend>>['emails']['send']>[0],
  options: RetryOptions,
  context?: { traceId?: string }
): Promise<void> {
  const { attempts, baseDelayMs, timeoutMs } = options
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Email send timeout')), timeoutMs)
      })
      
      // Race the send against timeout
      const sendPromise = resend.emails.send(payload)
      const response = await Promise.race([
        sendPromise,
        timeoutPromise,
      ]) as ResendEmailResponse
      
      // Check response object for errors (Resend SDK returns { data, error })
      if (response.error) {
        const errorMessage = response.error instanceof Error 
          ? response.error.message 
          : typeof response.error === 'string' 
            ? response.error 
            : JSON.stringify(response.error)
        
        const isLastAttempt = attempt === attempts
        
        if (isLastAttempt) {
          throw new Error(`Resend API error: ${errorMessage}`)
        }
        
        // Calculate exponential backoff delay
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        
        logger.warn('Email send retry', {
          to: maskEmail(email),
          attempt,
          reason: `Resend API error: ${errorMessage}`,
          nextDelayMs: delayMs,
          traceId: context?.traceId,
        })
        
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      
      // Validate that we have data (email ID) indicating success
      if (!response.data || !response.data.id) {
        const isLastAttempt = attempt === attempts
        
        if (isLastAttempt) {
          throw new Error('Response missing email ID')
        }
        
        // Calculate exponential backoff delay
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        
        logger.warn('Email send retry', {
          to: maskEmail(email),
          attempt,
          reason: 'Response missing email ID',
          responseData: response.data,
          nextDelayMs: delayMs,
          traceId: context?.traceId,
        })
        
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      
      // Success - log email ID for debugging
      logger.debug('Email send success', {
        to: maskEmail(email),
        emailId: response.data.id,
        attempt,
        traceId: context?.traceId,
      })
      
      return // Success
    } catch (error) {
      const isLastAttempt = attempt === attempts
      
      if (isLastAttempt) {
        throw error
      }
      
      // Calculate exponential backoff delay
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
      
      logger.warn('Email send retry', {
        to: maskEmail(email),
        attempt,
        reason: error instanceof Error ? error.message : 'Unknown error',
        nextDelayMs: delayMs,
        traceId: context?.traceId,
      })
      
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  
  throw new Error('All retry attempts exhausted')
}

/**
 * Get the Resend segment ID
 * Returns the segment ID (UUID)
 * 
 * First checks RESEND_SEGMENT_ID environment variable.
 * If not set, tries to list segments and uses the first/only one.
 */
async function getDefaultSegment(context?: { traceId?: string }): Promise<string> {
  logger.debug('segment.get_init', { traceId: context?.traceId })
  
  // First, check if segment ID is set in environment variable
  const envSegmentId = process.env.RESEND_SEGMENT_ID
  logger.debug('segment.env_check', {
    traceId: context?.traceId,
    hasEnvSegmentId: !!envSegmentId,
    envSegmentIdLength: envSegmentId?.length,
    envSegmentIdPrefix: envSegmentId ? envSegmentId.substring(0, 8) + '...' : undefined,
  })
  
  if (envSegmentId) {
    // Validate that the segment ID is a valid UUID
    if (!uuidValidate(envSegmentId)) {
      logger.error('segment.invalid_uuid', {
        segmentId: envSegmentId,
        traceId: context?.traceId,
      })
      throw new Error(`Invalid RESEND_SEGMENT_ID: "${envSegmentId}" is not a valid UUID`)
    }
    
    logger.info('segment.from_env', {
      segmentId: envSegmentId,
      traceId: context?.traceId,
    })
    return envSegmentId
  }
  
  logger.debug('segment.env_not_set', {
    traceId: context?.traceId,
    message: 'RESEND_SEGMENT_ID not set, attempting to list segments',
  })
  
  const resend = getResend()
  
  try {
    // Try to list segments - there should only be one
    // Use type assertion since segments API may not be in TypeScript definitions yet
    const resendWithSegments = resend as any
    
    logger.debug('segment.checking_api', {
      traceId: context?.traceId,
      hasSegments: !!resendWithSegments.segments,
      hasListFunction: typeof resendWithSegments.segments?.list === 'function',
      segmentsKeys: resendWithSegments.segments ? Object.keys(resendWithSegments.segments) : [],
    })
    
    if (typeof resendWithSegments.segments?.list === 'function') {
      logger.debug('segment.listing', {
        traceId: context?.traceId,
        limit: 10,
      })
      
      const listResponse = await resendWithSegments.segments.list({
        limit: 10,
      }) as { data: Array<{ id: string; name: string }> | null; error: any }
      
      logger.debug('segment.list_response', {
        traceId: context?.traceId,
        hasData: !!listResponse.data,
        dataLength: listResponse.data?.length ?? 0,
        hasError: !!listResponse.error,
        error: listResponse.error ? {
          message: listResponse.error.message || String(listResponse.error),
          type: typeof listResponse.error,
        } : null,
        fullResponse: {
          data: listResponse.data,
          error: listResponse.error,
        },
      })
      
      if (listResponse.error) {
        logger.error('segment.list_failed', {
          error: listResponse.error,
          errorType: typeof listResponse.error,
          errorMessage: listResponse.error?.message || String(listResponse.error),
          traceId: context?.traceId,
        })
        throw new Error(`Failed to list segments: ${listResponse.error}`)
      }
      
      if (!listResponse.data || listResponse.data.length === 0) {
        logger.error('segment.no_segments_found', {
          traceId: context?.traceId,
          responseData: listResponse.data,
        })
        throw new Error(
          'No segments found in Resend and RESEND_SEGMENT_ID is not set. ' +
          'Please set RESEND_SEGMENT_ID environment variable to your Resend segment UUID. ' +
          'You can find this in your Resend dashboard.'
        )
      }
      
      // Use the first segment (there should only be one)
      const segment = listResponse.data[0]
      
      // Validate that the segment ID is a valid UUID
      if (!uuidValidate(segment.id)) {
        logger.error('segment.invalid_uuid_from_api', {
          segmentId: segment.id,
          segmentName: segment.name,
          traceId: context?.traceId,
        })
        throw new Error(`Invalid segment ID from API: "${segment.id}" is not a valid UUID`)
      }
      
      logger.info('segment.found', {
        segmentId: segment.id,
        name: segment.name,
        totalSegments: listResponse.data.length,
        allSegments: listResponse.data.map(s => ({ id: s.id, name: s.name })),
        traceId: context?.traceId,
      })
      
      if (listResponse.data.length > 1) {
        logger.warn('segment.multiple_found', {
          totalSegments: listResponse.data.length,
          usingSegmentId: segment.id,
          allSegmentIds: listResponse.data.map(s => s.id),
          traceId: context?.traceId,
        })
      }
      
      return segment.id
    }
    
    // If SDK doesn't support segments API, throw helpful error
    logger.error('segment.api_not_available', {
      traceId: context?.traceId,
      hasSegments: !!resendWithSegments.segments,
      segmentsType: typeof resendWithSegments.segments,
      resendKeys: Object.keys(resendWithSegments),
    })
    
    throw new Error(
      'RESEND_SEGMENT_ID environment variable is required. ' +
      'Please set it to your Resend segment UUID (e.g., RESEND_SEGMENT_ID=43a6084d-7071-46dd-8eae-357f96ed66f0). ' +
      'You can find this in your Resend dashboard.'
    )
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : {
      type: typeof error,
      value: String(error),
    }
    
    logger.error('segment.get_failed', {
      error: errorDetails,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      traceId: context?.traceId,
    })
    throw error
  }
}

/**
 * Add contact to Resend segment
 * Uses resend.contacts.segments.add() which can add by email or contactId
 */
export async function addContactToResend(
  email: string,
  context?: { traceId?: string }
): Promise<void> {
  // Check feature flag - graceful degradation if disabled
  if (process.env.ENABLE_RESEND_CONTACT_ADDITION !== 'true') {
    logger.debug('contact.add_disabled', {
      to: maskEmail(email),
      traceId: context?.traceId,
      reason: 'ENABLE_RESEND_CONTACT_ADDITION feature flag is not enabled',
    })
    return
  }

  logger.info('contact.add_init', {
    to: maskEmail(email),
    traceId: context?.traceId,
  })
  
  try {
    // Initialize Resend client and log structure
    logger.debug('contact.resend_client_init', {
      to: maskEmail(email),
      traceId: context?.traceId,
    })
    
    const resend = getResend()
    const resendAny = resend as any
    
    // Log Resend client structure for debugging
    logger.debug('contact.resend_client_structure', {
      to: maskEmail(email),
      traceId: context?.traceId,
      hasContacts: !!resendAny.contacts,
      hasSegments: !!resendAny.segments,
      contactsType: typeof resendAny.contacts,
      segmentsType: typeof resendAny.segments,
      contactsKeys: resendAny.contacts ? Object.keys(resendAny.contacts) : [],
      segmentsKeys: resendAny.segments ? Object.keys(resendAny.segments) : [],
      hasContactsSegments: !!resendAny.contacts?.segments,
      contactsSegmentsType: typeof resendAny.contacts?.segments,
      contactsSegmentsKeys: resendAny.contacts?.segments ? Object.keys(resendAny.contacts.segments) : [],
      hasContactsCreate: typeof resendAny.contacts?.create === 'function',
      hasContactsGet: typeof resendAny.contacts?.get === 'function',
      hasContactsSegmentsAdd: typeof resendAny.contacts?.segments?.add === 'function',
      resendKeys: Object.keys(resendAny).filter(key => !key.startsWith('_')),
    })
    
    // Get segment ID
    logger.debug('contact.getting_segment', {
      to: maskEmail(email),
      traceId: context?.traceId,
    })
    
    const segmentId = await getDefaultSegment(context)
    
    logger.info('contact.segment_id_retrieved', {
      to: maskEmail(email),
      segmentId,
      traceId: context?.traceId,
    })
    
    // Step 1: Create the contact first (or get it if it already exists)
    let contactId: string | undefined
    let contactCreationSucceeded = false
    
    logger.debug('contact.creation_start', {
      to: maskEmail(email),
      traceId: context?.traceId,
    })
    
    try {
      // Validate audienceId is a valid UUID before using it
      if (!uuidValidate(RESEND_AUDIENCE_ID)) {
        logger.error('contact.invalid_audience_id', {
          to: maskEmail(email),
          audienceId: RESEND_AUDIENCE_ID,
          traceId: context?.traceId,
        })
        throw new Error(`Invalid RESEND_AUDIENCE_ID: "${RESEND_AUDIENCE_ID}" is not a valid UUID`)
      }
      
      // Create contact with audienceId - this adds the contact to the audience
      // audienceId must be a valid UUID string
      const createPayload = {
        email,
        unsubscribed: false,
        audienceId: RESEND_AUDIENCE_ID as string, // UUID string for the audience - required by SDK types
      }
      
      logger.debug('contact.creation_payload', {
        to: maskEmail(email),
        payload: {
          email: createPayload.email,
          unsubscribed: createPayload.unsubscribed,
          audienceId: createPayload.audienceId,
        },
        traceId: context?.traceId,
      })
      
      const createResponse = await resend.contacts.create(createPayload)
      
      logger.debug('contact.creation_response', {
        to: maskEmail(email),
        traceId: context?.traceId,
        hasData: !!createResponse.data,
        hasError: !!createResponse.error,
        data: createResponse.data,
        error: createResponse.error ? {
          message: createResponse.error.message || String(createResponse.error),
          type: typeof createResponse.error,
          fullError: createResponse.error,
        } : null,
        fullResponse: createResponse,
      })
      
      if (createResponse.error) {
        const errorMessage = createResponse.error.message || createResponse.error.toString()
        
        logger.debug('contact.creation_error_received', {
          to: maskEmail(email),
          errorMessage,
          errorType: typeof createResponse.error,
          fullError: createResponse.error,
          traceId: context?.traceId,
        })
        
        // If contact already exists, that's fine - we can use email for segment addition
        if (errorMessage.includes('already exists') || errorMessage.includes('already_exist')) {
          logger.info('contact.already_exists', {
            to: maskEmail(email),
            traceId: context?.traceId,
          })
          // Contact exists, we'll use email to add to segment
          // Try to get contact by email if API supports it
          if (typeof resendAny.contacts?.get === 'function') {
            logger.debug('contact.attempting_get_by_email', {
              to: maskEmail(email),
              traceId: context?.traceId,
            })
            try {
              const getResponse = await resendAny.contacts.get({ email }) as { data: { id: string } | null; error: any }
              
              logger.debug('contact.get_by_email_response', {
                to: maskEmail(email),
                traceId: context?.traceId,
                hasData: !!getResponse.data,
                hasError: !!getResponse.error,
                data: getResponse.data,
                error: getResponse.error,
                fullResponse: getResponse,
              })
              
              if (getResponse.data?.id) {
                contactId = getResponse.data.id
                logger.info('contact.retrieved_by_email', {
                  to: maskEmail(email),
                  contactId,
                  traceId: context?.traceId,
                })
              } else {
                logger.debug('contact.get_by_email_no_id', {
                  to: maskEmail(email),
                  traceId: context?.traceId,
                  responseData: getResponse.data,
                })
              }
            } catch (getError) {
              // Getting by email failed, that's ok - we'll use email for segment
              const getErrorDetails = getError instanceof Error ? {
                message: getError.message,
                name: getError.name,
                stack: getError.stack,
              } : {
                type: typeof getError,
                value: String(getError),
              }
              
              logger.debug('contact.get_by_email_failed', {
                to: maskEmail(email),
                error: getErrorDetails,
                errorType: getError instanceof Error ? getError.constructor.name : typeof getError,
                traceId: context?.traceId,
              })
            }
          } else {
            logger.debug('contact.get_by_email_not_available', {
              to: maskEmail(email),
              traceId: context?.traceId,
            })
          }
        } else {
          // Contact creation failed, but we can still try to add to segment using email
          logger.warn('contact.create_failed_continuing', {
            to: maskEmail(email),
            error: errorMessage,
            errorType: typeof createResponse.error,
            fullError: createResponse.error,
            traceId: context?.traceId,
            message: 'Contact creation failed, but will attempt to add to segment using email',
          })
          // Continue to try adding to segment with email - don't return early
        }
      } else if (createResponse.data?.id) {
        contactId = createResponse.data.id
        contactCreationSucceeded = true
        logger.info('contact.created', {
          to: maskEmail(email),
          contactId,
          traceId: context?.traceId,
        })
      } else {
        // No error but no data either - unexpected response
        logger.warn('contact.create_unexpected_response', {
          to: maskEmail(email),
          responseData: createResponse.data,
          fullResponse: createResponse,
          traceId: context?.traceId,
        })
        // Continue to try adding to segment with email
      }
    } catch (createError) {
      // If creation fails for other reasons, log but continue to try adding to segment with email
      const errorDetails = createError instanceof Error ? {
        message: createError.message,
        name: createError.name,
        stack: createError.stack,
      } : {
        type: typeof createError,
        value: String(createError),
      }
      
      logger.error('contact.create_exception', {
        to: maskEmail(email),
        error: errorDetails,
        errorType: createError instanceof Error ? createError.constructor.name : typeof createError,
        traceId: context?.traceId,
      })
      // Continue to try adding to segment with email
    }
    
    // Step 2: Add contact to segment using segments.add API
    // According to Resend docs: resend.contacts.segments.add({ email, segmentId }) or { contactId, segmentId }
    
    // Validate segmentId is a valid UUID before using it
    if (!segmentId || !uuidValidate(segmentId)) {
      logger.error('contact.invalid_segment_id', {
        to: maskEmail(email),
        segmentId,
        segmentIdType: typeof segmentId,
        traceId: context?.traceId,
      })
      throw new Error(`Invalid segment ID: "${segmentId}" is not a valid UUID`)
    }
    
    logger.debug('contact.segment_addition_start', {
      to: maskEmail(email),
      segmentId,
      contactId,
      contactCreationSucceeded,
      traceId: context?.traceId,
    })
    
    // Check if segments API exists
    logger.debug('contact.checking_segments_api', {
      to: maskEmail(email),
      segmentId,
      traceId: context?.traceId,
      hasContacts: !!resendAny.contacts,
      hasContactsSegments: !!resendAny.contacts?.segments,
      contactsSegmentsType: typeof resendAny.contacts?.segments,
      contactsSegmentsKeys: resendAny.contacts?.segments ? Object.keys(resendAny.contacts.segments) : [],
      hasAddFunction: typeof resendAny.contacts?.segments?.add === 'function',
    })
    
    if (!resendAny.contacts?.segments) {
      logger.error('contact.segments_api_not_available', {
        to: maskEmail(email),
        segmentId,
        traceId: context?.traceId,
        hasContacts: !!resendAny.contacts,
        contactsKeys: resendAny.contacts ? Object.keys(resendAny.contacts) : [],
        contactsType: typeof resendAny.contacts,
        sdkVersion: '4.0.0',
        resendClientStructure: {
          hasContacts: !!resendAny.contacts,
          hasSegments: !!resendAny.segments,
          contactsKeys: resendAny.contacts ? Object.keys(resendAny.contacts) : [],
          segmentsKeys: resendAny.segments ? Object.keys(resendAny.segments) : [],
        },
      })
      throw new Error('Resend contacts.segments.add API not available. Please check Resend SDK version.')
    }
    
    // Step 2: Add contact to segment
    // If we have a contactId, use it to add to segment (POST /contacts/:contact_id/segments/:segment_id)
    // Otherwise, try using email
    if (!segmentId) {
      logger.error('contact.segment_id_undefined', {
        to: maskEmail(email),
        segmentId,
        segmentIdType: typeof segmentId,
        traceId: context?.traceId,
      })
      throw new Error('Segment ID is undefined - cannot add contact to segment')
    }
    
    logger.debug('contact.segment_addition_start', {
      to: maskEmail(email),
      segmentId,
      contactId,
      hasContactId: !!contactId,
      traceId: context?.traceId,
    })
    
    try {
      let segmentResponse: { data: any; error: any }
      
      if (contactId) {
        // Use contact ID to add to segment - endpoint: POST /contacts/:contact_id/segments/:segment_id
        logger.debug('contact.adding_to_segment_with_contact_id', {
          to: maskEmail(email),
          contactId,
          segmentId,
          traceId: context?.traceId,
        })
        
        // Try the method signature: contacts(contactId).segments.add(segmentId) or similar
        // If that doesn't work, fall back to contacts.segments.add({ contactId, segmentId })
        if (typeof resendAny.contacts === 'function') {
          // If contacts is a function, try: resend.contacts(contactId).segments.add(segmentId)
          try {
            const contactResource = resendAny.contacts(contactId)
            if (contactResource?.segments?.add) {
              segmentResponse = await contactResource.segments.add(segmentId) as { data: any; error: any }
              logger.debug('contact.segment_add_via_contact_resource', {
                to: maskEmail(email),
                contactId,
                segmentId,
                traceId: context?.traceId,
              })
            } else {
              // Fall back to standard method
              segmentResponse = await resendAny.contacts.segments.add({ contactId, segmentId }) as { data: any; error: any }
            }
          } catch (resourceError) {
            // Fall back to standard method
            logger.debug('contact.falling_back_to_standard_method', {
              to: maskEmail(email),
              contactId,
              segmentId,
              error: resourceError instanceof Error ? resourceError.message : String(resourceError),
              traceId: context?.traceId,
            })
            segmentResponse = await resendAny.contacts.segments.add({ contactId, segmentId }) as { data: any; error: any }
          }
        } else {
          // Standard method: contacts.segments.add({ contactId, segmentId })
          segmentResponse = await resendAny.contacts.segments.add({ contactId, segmentId }) as { data: any; error: any }
        }
      } else {
        // No contact ID, try using email
        logger.debug('contact.adding_to_segment_with_email', {
          to: maskEmail(email),
          segmentId,
          traceId: context?.traceId,
        })
        segmentResponse = await resendAny.contacts.segments.add({ email, segmentId }) as { data: any; error: any }
      }
      
      logger.debug('contact.segment_addition_response', {
        to: maskEmail(email),
        segmentId,
        contactId,
        traceId: context?.traceId,
        hasData: !!segmentResponse.data,
        hasError: !!segmentResponse.error,
        data: segmentResponse.data,
        error: segmentResponse.error ? {
          message: segmentResponse.error.message || String(segmentResponse.error),
          type: typeof segmentResponse.error,
          fullError: segmentResponse.error,
        } : null,
        fullResponse: segmentResponse,
      })
      
      if (segmentResponse.error) {
        const errorMessage = segmentResponse.error.message || segmentResponse.error.toString()
        
        logger.debug('contact.segment_addition_error', {
          to: maskEmail(email),
          segmentId,
          contactId,
          errorMessage,
          errorType: typeof segmentResponse.error,
          fullError: segmentResponse.error,
          traceId: context?.traceId,
        })
        
        // If contact is already in segment, that's fine
        if (errorMessage.includes('already') || errorMessage.includes('exists')) {
          logger.info('contact.already_in_segment', {
            to: maskEmail(email),
            segmentId,
            contactId,
            traceId: context?.traceId,
          })
          return
        }
        
        // If error mentions UUID, it might be because contactId is invalid
        if (errorMessage.includes('UUID') && contactId) {
          logger.warn('contact.segment_add_uuid_error', {
            to: maskEmail(email),
            segmentId,
            contactId,
            error: errorMessage,
            fullError: segmentResponse.error,
            traceId: context?.traceId,
          })
          // Retry with email instead of contactId
          if (contactId) {
            logger.debug('contact.retrying_with_email', {
              to: maskEmail(email),
              segmentId,
              originalContactId: contactId,
              traceId: context?.traceId,
            })
            try {
              const retryParams = { email, segmentId }
              logger.debug('contact.retry_params', {
                to: maskEmail(email),
                segmentId,
                segmentIdInRetryParams: retryParams.segmentId,
                params: retryParams,
                paramsStringified: JSON.stringify(retryParams),
                traceId: context?.traceId,
              })
              
              const retryResponse = await resendAny.contacts.segments.add(retryParams) as { data: any; error: any }
              
              logger.debug('contact.retry_response', {
                to: maskEmail(email),
                segmentId,
                traceId: context?.traceId,
                hasData: !!retryResponse.data,
                hasError: !!retryResponse.error,
                data: retryResponse.data,
                error: retryResponse.error ? {
                  message: retryResponse.error.message || String(retryResponse.error),
                  type: typeof retryResponse.error,
                  fullError: retryResponse.error,
                } : null,
                fullResponse: retryResponse,
              })
              
              if (retryResponse.error) {
                const retryErrorMessage = retryResponse.error.message || retryResponse.error.toString()
                if (retryErrorMessage.includes('already') || retryErrorMessage.includes('exists')) {
                  logger.info('contact.already_in_segment_retry', {
                    to: maskEmail(email),
                    segmentId,
                    traceId: context?.traceId,
                  })
                  return
                }
                throw new Error(retryErrorMessage)
              }
              
              logger.info('contact.added_to_segment_retry', {
                to: maskEmail(email),
                segmentId,
                traceId: context?.traceId,
              })
              return
            } catch (retryError) {
              const retryErrorDetails = retryError instanceof Error ? {
                message: retryError.message,
                name: retryError.name,
                stack: retryError.stack,
              } : {
                type: typeof retryError,
                value: String(retryError),
              }
              
              logger.error('contact.retry_failed', {
                to: maskEmail(email),
                segmentId,
                error: retryErrorDetails,
                errorType: retryError instanceof Error ? retryError.constructor.name : typeof retryError,
                traceId: context?.traceId,
              })
              throw retryError
            }
          }
        }
        
        throw new Error(errorMessage)
      }
      
      logger.info('contact.added_to_segment', {
        to: maskEmail(email),
        segmentId,
        contactId,
        responseData: segmentResponse.data,
        traceId: context?.traceId,
      })
    } catch (segmentsError) {
      // If the error is about segments not existing, log detailed info
      const segmentsErrorDetails = segmentsError instanceof Error ? {
        message: segmentsError.message,
        name: segmentsError.name,
        stack: segmentsError.stack,
      } : {
        type: typeof segmentsError,
        value: String(segmentsError),
      }
      
      logger.error('contact.segment_addition_exception', {
        to: maskEmail(email),
        segmentId,
        error: segmentsErrorDetails,
        errorType: segmentsError instanceof Error ? segmentsError.constructor.name : typeof segmentsError,
        traceId: context?.traceId,
      })
      
      if (segmentsError instanceof Error && segmentsError.message.includes('Cannot read properties of undefined')) {
        const contactsKeys = resendAny.contacts ? Object.keys(resendAny.contacts) : []
        const segmentsKeys = resendAny.segments ? Object.keys(resendAny.segments) : []
        logger.error('contact.segments_api_error', {
          to: maskEmail(email),
          segmentId,
          traceId: context?.traceId,
          hasContacts: !!resendAny.contacts,
          hasSegments: !!resendAny.segments,
          contactsKeys,
          segmentsKeys,
          error: segmentsError.message,
          fullError: segmentsErrorDetails,
        })
        throw new Error('Resend contacts.segments.add API not available. Please check Resend SDK version.')
      }
      throw segmentsError
    }
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
    } : {
      type: typeof error,
      value: String(error),
    }
    
    // If contact is already in segment, that's fine
    if (error instanceof Error && (error.message.includes('already') || error.message.includes('exists'))) {
      logger.info('contact.segment_exists', {
        to: maskEmail(email),
        error: errorDetails,
        traceId: context?.traceId,
      })
      return
    }
    
    logger.error('contact.add_failed', {
      to: maskEmail(email),
      error: errorDetails,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      traceId: context?.traceId,
    })
    // Don't throw - email failures shouldn't block signup or purchase
  }
}

/**
 * Send a purchase confirmation email
 */
export async function sendPurchaseConfirmation(data: {
  to: string
  customerName?: string
  orderNumber: string
  orderDate: string
  items: Array<{
    productName: string
    athleteName: string
    quantity: number
    unitPriceCents: number
    sessionDate?: string // Legacy field, kept for backward compatibility
    sessionTime?: string // Legacy field, kept for backward compatibility
    sessions?: Array<{ session_date: string; session_time: string }> // New field for multiple sessions
    gender?: string | null
    minGrade?: string | null
    maxGrade?: string | null
    skillLevel?: string | null
    location?: string
  }>
  totalAmountCents: number
  currency?: string
  context?: { traceId?: string }
}): Promise<void> {
  const { context } = data
  
  // Validate inputs
  if (!data.to || typeof data.to !== 'string' || data.to.trim().length === 0) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Invalid or empty email address',
      traceId: context?.traceId,
    })
    return
  }
  
  if (!data.orderNumber || !data.orderDate) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Missing orderNumber or orderDate',
      traceId: context?.traceId,
    })
    return
  }
  
  if (!data.items || data.items.length === 0) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Items array is empty',
      traceId: context?.traceId,
    })
    return
  }
  
  let html: string
  const subject = `Order Confirmation - ${data.orderNumber}`
  
  // Render template with separate try/catch
  try {
    html = await renderEmailTemplate(
      <PurchaseConfirmationEmail
        orderNumber={data.orderNumber}
        orderDate={data.orderDate}
        customerName={data.customerName}
        items={data.items}
        totalAmountCents={data.totalAmountCents}
        currency={data.currency}
      />
    )
    
    logger.debug('purchase_confirmation.render_ok', {
      to: maskEmail(data.to),
      subject,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('purchase_confirmation.render_failed', {
      to: maskEmail(data.to),
      templateName: 'PurchaseConfirmationEmail',
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    return
  }
  
  // Send email with separate try/catch
  try {
    const resend = getResend()
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject,
      html,
    }) as ResendEmailResponse
    
    // Check response object for errors (Resend SDK returns { data, error })
    if (response.error) {
      logger.error('purchase_confirmation.send_failed', {
        to: maskEmail(data.to),
        subject,
        error: response.error instanceof Error 
          ? response.error.message 
          : typeof response.error === 'string' 
            ? response.error 
            : JSON.stringify(response.error),
        responseError: response.error,
        traceId: context?.traceId,
      })
      // Don't throw - email failures shouldn't block payment processing
      return
    }
    
    // Validate that we have data (email ID) indicating success
    if (!response.data || !response.data.id) {
      logger.error('purchase_confirmation.send_failed', {
        to: maskEmail(data.to),
        subject,
        error: 'Response missing email ID',
        responseData: response.data,
        traceId: context?.traceId,
      })
      // Don't throw - email failures shouldn't block payment processing
      return
    }
    
    logger.info('purchase_confirmation.send_ok', {
      to: maskEmail(data.to),
      subject,
      emailId: response.data.id,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('purchase_confirmation.send_failed', {
      to: maskEmail(data.to),
      subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      traceId: context?.traceId,
    })
    // Don't throw - email failures shouldn't block payment processing
  }
}

/**
 * Send a broadcast email to Resend segment using Broadcasts API
 */
export async function sendBroadcastToAudience(data: {
  audienceId: string
  subject: string
  bodyText: string
  context?: { traceId?: string }
}): Promise<{ broadcastId: string }> {
  const { context } = data
  
  // Check feature flag - throw error if disabled
  if (process.env.ENABLE_BROADCAST_FEATURE !== 'true') {
    logger.error('broadcast.disabled', {
      subject: data.subject,
      traceId: context?.traceId,
      reason: 'ENABLE_BROADCAST_FEATURE feature flag is not enabled',
    })
    throw new Error('Broadcast feature is disabled. Set ENABLE_BROADCAST_FEATURE=true to enable.')
  }
  
  // Render email template
  let html: string
  try {
    html = await renderEmailTemplate(
      <BroadcastEmail
        subject={data.subject}
        bodyText={data.bodyText}
        preview={data.subject}
      />
    )
    
    logger.debug('broadcast.render_ok', {
      subject: data.subject,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('broadcast.render_failed', {
      templateName: 'BroadcastEmail',
      subject: data.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    throw new Error('Failed to render email template')
  }

  try {
    const resend = getResend()
    
    // Get the default segment if audienceId is 'default' (legacy parameter name, actually a segment ID)
    let segmentId = data.audienceId
    if (segmentId === 'default') {
      segmentId = await getDefaultSegment(context)
    }
    
    // Create broadcast with a small delay to avoid rate limits
    // Resend allows only 2 requests per second
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Create broadcast
    const createResponse = await resend.broadcasts.create({
      audienceId: segmentId,
      from: FROM_EMAIL,
      subject: data.subject,
      html,
    }) as { data: { id: string } | null; error: any }

    if (createResponse.error) {
      logger.error('broadcast.create_failed', {
        subject: data.subject,
        error: createResponse.error,
        traceId: context?.traceId,
      })
      throw new Error(`Failed to create broadcast: ${createResponse.error}`)
    }

    if (!createResponse.data?.id) {
      logger.error('broadcast.create_no_id', {
        subject: data.subject,
        traceId: context?.traceId,
      })
      throw new Error('Broadcast created but no ID returned')
    }

    const broadcastId = createResponse.data.id

    // Send broadcast
    const sendResponse = await resend.broadcasts.send(broadcastId) as { data: any; error: any }

    if (sendResponse.error) {
      logger.error('broadcast.send_failed', {
        broadcastId,
        subject: data.subject,
        error: sendResponse.error,
        traceId: context?.traceId,
      })
      throw new Error(`Failed to send broadcast: ${sendResponse.error}`)
    }

    logger.info('broadcast.sent', {
      broadcastId,
      subject: data.subject,
      segmentId,
      traceId: context?.traceId,
    })

    return { broadcastId }
  } catch (error) {
    logger.error('broadcast.error', {
      subject: data.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    throw error
  }
}

/**
 * Send a broadcast email to multiple recipients
 * @deprecated Use sendBroadcastToAudience instead for better performance and reliability
 */
export async function sendBroadcastEmail(data: {
  to: string[]
  subject: string
  bodyText: string
  context?: { traceId?: string }
}): Promise<{ sent: number; failed: number }> {
  const { context } = data
  
  // Filter and validate email addresses
  const validEmails = data.to.filter(email => isValidEmail(email))
  const invalidCount = data.to.length - validEmails.length
  
  if (invalidCount > 0) {
    logger.warn('broadcast.validation', {
      invalidCount,
      totalCount: data.to.length,
      traceId: context?.traceId,
    })
  }
  
  if (validEmails.length === 0) {
    logger.warn('broadcast.no_valid_recipients', {
      totalCount: data.to.length,
      traceId: context?.traceId,
    })
    return { sent: 0, failed: 0 }
  }
  
  let sent = 0
  let failed = 0
  
  // Resend has rate limits, so we'll batch send
  const BATCH_SIZE = 10 // Adjust based on Resend rate limits
  const totalRecipients = validEmails.length
  const batches = Math.ceil(totalRecipients / BATCH_SIZE)
  
  // Render template once before batch sending
  let html: string
  try {
    html = await renderEmailTemplate(
      <BroadcastEmail
        subject={data.subject}
        bodyText={data.bodyText}
        preview={data.subject}
      />
    )
    
    logger.debug('broadcast.render_ok', {
      subject: data.subject,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('broadcast.render_failed', {
      templateName: 'BroadcastEmail',
      subject: data.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    return { sent: 0, failed: totalRecipients }
  }
  
  // Send in batches
  for (let i = 0; i < validEmails.length; i += BATCH_SIZE) {
    const batch = validEmails.slice(i, i + BATCH_SIZE)
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    const batchStartTime = Date.now()
    let sentInBatch = 0
    let failedInBatch = 0
    
    logger.info('broadcast.batch.start', {
      batchIndex,
      size: batch.length,
      traceId: context?.traceId,
    })
    
    // Send to batch with retry
    const promises = batch.map(async (email) => {
      try {
        const resend = getResend()
        await sendWithRetry(
          email,
          {
            from: FROM_EMAIL,
            to: email,
            subject: data.subject,
            html,
          },
          {
            attempts: 3,
            baseDelayMs: 300,
            timeoutMs: 8000,
          },
          context
        )
        sentInBatch++
        sent++
      } catch (error) {
        failedInBatch++
        failed++
        logger.error('broadcast.send_failed', {
          to: maskEmail(email),
          subject: data.subject,
          batchIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          traceId: context?.traceId,
        })
      }
    })
    
    await Promise.all(promises)
    
    const batchDurationMs = Date.now() - batchStartTime
    
    logger.info('broadcast.batch.done', {
      batchIndex,
      sentInBatch,
      failedInBatch,
      durationMs: batchDurationMs,
      traceId: context?.traceId,
    })
    
    // Rate limiting: wait between batches
    if (i + BATCH_SIZE < validEmails.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
    }
  }
  
  logger.info('broadcast.done', {
    totalRecipients,
    sent,
    failed,
    batches,
    traceId: context?.traceId,
  })
  
  return { sent, failed }
}
