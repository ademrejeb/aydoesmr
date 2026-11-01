import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

export const SERVICE_PRIORITIES = ["P1", "P2", "P3", "P4"] as const
export type ServicePriorityInput = (typeof SERVICE_PRIORITIES)[number]

export const REQUEST_STATUSES = [
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "FULFILLED",
  "CANCELLED",
  "CLOSED",
] as const
export type RequestStatusInput = (typeof REQUEST_STATUSES)[number]

export const INCIDENT_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
export type IncidentStatusInput = (typeof INCIDENT_STATUSES)[number]

export const FORM_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox"] as const
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[]
}

// ------------------------------------------------------------------ //
//  Catalog                                                             //
// ------------------------------------------------------------------ //

export class CreateServiceItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(1000)
  description!: string

  @IsString()
  @MaxLength(40)
  category!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number

  @IsOptional()
  @IsInt()
  sortOrder?: number

  @IsOptional()
  @IsArray()
  formSchema?: FormField[]
}

export class UpdateServiceItemDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(1000) description?: string
  @IsOptional() @IsString() @MaxLength(40) category?: string
  @IsOptional() @IsString() @MaxLength(40) icon?: string
  @IsOptional() @IsBoolean() active?: boolean
  @IsOptional() @IsBoolean() requiresApproval?: boolean
  @IsOptional() @IsInt() estimatedDays?: number
  @IsOptional() @IsInt() sortOrder?: number
  @IsOptional() @IsArray() formSchema?: FormField[]
}

// ------------------------------------------------------------------ //
//  Service requests                                                    //
// ------------------------------------------------------------------ //

export class CreateServiceRequestDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string

  @IsString()
  @MaxLength(4000)
  description!: string

  @IsOptional()
  @IsString()
  itemId?: string

  @IsOptional()
  @IsIn(SERVICE_PRIORITIES)
  priority?: ServicePriorityInput

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>

  @IsOptional()
  @IsString()
  assigneeId?: string
}

export class UpdateServiceRequestDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string
  @IsOptional() @IsString() @MaxLength(4000) description?: string
  @IsOptional() @IsIn(SERVICE_PRIORITIES) priority?: ServicePriorityInput
  @IsOptional() @IsString() assigneeId?: string
}

export class DecideRequestDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED"

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class RequestStatusDto {
  @IsIn(REQUEST_STATUSES)
  status!: RequestStatusInput

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number
}

export class RateRequestDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number
}

// ------------------------------------------------------------------ //
//  Incidents                                                           //
// ------------------------------------------------------------------ //

export class CreateIncidentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string

  @IsString()
  @MaxLength(4000)
  description!: string

  @IsOptional()
  @IsIn(SERVICE_PRIORITIES)
  priority?: ServicePriorityInput

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string

  @IsOptional()
  @IsString()
  assigneeId?: string

  @IsOptional()
  @IsString()
  linkedRequestId?: string
}

export class UpdateIncidentDto {
  @IsOptional() @IsIn(SERVICE_PRIORITIES) priority?: ServicePriorityInput
  @IsOptional() @IsString() @MaxLength(60) category?: string
  @IsOptional() @IsString() assigneeId?: string
  @IsOptional() @IsString() @MaxLength(2000) resolution?: string
  @IsOptional() @IsString() @MaxLength(2000) rootCause?: string
}

export class IncidentStatusDto {
  @IsIn(INCIDENT_STATUSES)
  status!: IncidentStatusInput

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rootCause?: string
}

// ------------------------------------------------------------------ //
//  Comments + knowledge                                                //
// ------------------------------------------------------------------ //

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string

  @IsOptional()
  @IsBoolean()
  internal?: boolean
}

export class CreateArticleDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string

  @IsString()
  @MaxLength(20000)
  body!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  summary?: string

  @IsString()
  @MaxLength(40)
  category!: string

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  published?: boolean
}

export class UpdateArticleDto {
  @IsOptional() @IsString() @MinLength(4) @MaxLength(160) title?: string
  @IsOptional() @IsString() @MaxLength(20000) body?: string
  @IsOptional() @IsString() @MaxLength(200) summary?: string
  @IsOptional() @IsString() @MaxLength(40) category?: string
  @IsOptional() @IsArray() tags?: string[]
  @IsOptional() @IsBoolean() published?: boolean
}

export class ArticleFeedbackDto {
  @IsBoolean()
  helpful!: boolean
}

// ------------------------------------------------------------------ //
//  SLA                                                                 //
// ------------------------------------------------------------------ //

export class UpdateSlaPolicyDto {
  @IsIn(SERVICE_PRIORITIES)
  priority!: ServicePriorityInput

  @IsString()
  @MaxLength(60)
  name!: string

  @IsInt()
  @Min(1)
  responseMinutes!: number

  @IsInt()
  @Min(1)
  resolveMinutes!: number

  @IsOptional()
  @IsBoolean()
  businessHoursOnly?: boolean

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

// ------------------------------------------------------------------ //
//  Query + public portal                                               //
// ------------------------------------------------------------------ //

export class ListRequestsQueryDto {
  @IsOptional() @IsIn(REQUEST_STATUSES) status?: string
  @IsOptional() @IsIn(SERVICE_PRIORITIES) priority?: string
  @IsOptional() @IsString() itemId?: string
  @IsOptional() @IsString() assigneeId?: string
  /** "true" | "false" | "unassigned" | "mine" */
  @IsOptional() @IsString() view?: string
  @IsOptional() @IsString() search?: string
  @IsOptional() @IsString() limit?: string
}

export class ListIncidentsQueryDto {
  @IsOptional() @IsIn(INCIDENT_STATUSES) status?: string
  @IsOptional() @IsIn(SERVICE_PRIORITIES) priority?: string
  @IsOptional() @IsString() assigneeId?: string
  @IsOptional() @IsString() breached?: string
  @IsOptional() @IsString() view?: string
  @IsOptional() @IsString() search?: string
  @IsOptional() @IsString() limit?: string
}

export class PublicRequestDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string
  @IsString() @IsEmail() @MaxLength(160) email!: string
  @IsString() @MinLength(4) @MaxLength(160) title!: string
  @IsString() @MaxLength(4000) description!: string
  @IsOptional() @IsString() itemId?: string
  @IsOptional() @IsIn(SERVICE_PRIORITIES) priority?: ServicePriorityInput
  @IsOptional() @IsObject() formData?: Record<string, unknown>
  /** Honeypot — must stay empty. Bots fill it, humans never see it. */
  @IsOptional() @IsString() @MaxLength(200) website?: string
  @IsOptional() @IsString() @MaxLength(60) orgSlug?: string
}

export class PublicIncidentDto extends PublicRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string
}

export class PublicTrackQueryDto {
  @IsString() @MinLength(3) @MaxLength(40) number!: string
  @IsString() @IsEmail() @MaxLength(160) email!: string
  @IsOptional() @IsString() @MaxLength(60) orgSlug?: string
}

export class PublicCatalogQueryDto {
  @IsOptional() @IsString() @MaxLength(60) orgSlug?: string
}