"use client"

import * as React from "react"
import { Field } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

function FormField({
  className,
  ...props
}: React.ComponentProps<typeof Field.Root>) {
  return (
    <Field.Root
      data-slot="form-field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Field.Label>) {
  return (
    <Field.Label
      data-slot="form-label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<typeof Field.Description>) {
  return (
    <Field.Description
      data-slot="form-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormError({
  className,
  children,
  match = true,
  ...props
}: React.ComponentProps<typeof Field.Error>) {
  if (!children) return null

  return (
    <Field.Error
      data-slot="form-error"
      match={match}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {children}
    </Field.Error>
  )
}

export { FormField, FormLabel, FormDescription, FormError }
