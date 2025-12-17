# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Experiment Lacrosse (formerly "The Lacrosse Lab" until December 17, 2025) is a Next.js 15 web application for youth lacrosse training session management. It handles user registration, athlete management, shopping cart, Stripe payments, and email communications via Resend.

## Your Role


## Key Info and Gotchas

- Products in stripe correspond to a session or group of sessions.  For example, a 'winter league' product could be 6 sessions total. A user is only allowed to purchase all 6 because they are one product
- the core goal for users is to seamlessly direct them to pay for as many sessions as possible and make it VERY clear when and where the sessions are occurring
   - users are big fans of email and email clarity and deliverability upon purchase are very important
- The stripe webhook is the driver of a lot of app logic. 
- The admin dashboard is a critical feature that allows admins (coaches) to manage athletes and sessions in real time
   - their core behaviors are:
      - view session rosters (i.e who's coming)
      - taking attendance
      - issuing refunds or adding new athletes that paid IRL
      - reviewing key financial metrics
