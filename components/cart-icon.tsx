"use client"

import { ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useCart } from "@/contexts/cart-context"
import Link from "next/link"

export function CartIcon() {
  const { getTotalItems } = useCart()
  const totalItems = getTotalItems()

  return (
    <div className="px-2">
    <Link href="/cart" className="relative" data-testid="cart-icon">
      <ShoppingCart className="h-5 w-5" />
      {totalItems > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
          data-testid="cart-count"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </Badge>
      )}
    </Link>
    </div>
  )
}
