variable "name" {
  description = "Name prefix (e.g. rooferslabs-production)."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "api_domain" {
  description = "Public hostname for the API (e.g. api.rooferslabs.com)."
  type        = string
}

variable "api_container_port" {
  type    = number
  default = 4000
}

variable "enable_https" {
  description = "Attach the ACM certificate and serve HTTPS. Enable after the certificate's DNS validation records exist in Cloudflare."
  type        = bool
  default     = false
}

variable "ingress_cidr_blocks" {
  description = "CIDR ranges allowed to reach the ALB. Restrict to Cloudflare's ranges once DNS is proxied."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
