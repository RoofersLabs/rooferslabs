# =============================================================================
# Terraform state backend — bootstrap
# =============================================================================
# The one stack that cannot keep its own state remotely, because it is what
# creates the remote state. Its own state stays local and is committed nowhere;
# losing it is harmless, since everything here can be re-imported in a minute
# and nothing here holds a secret.
#
# Apply this ONCE, before migrating either environment:
#
#   cd infra/terraform/bootstrap && terraform init && terraform apply
#
# Then uncomment the backend block in each environment's providers.tf and run
# `terraform init -migrate-state` there.
#
# Locking uses S3 conditional writes (`use_lockfile = true`, Terraform >= 1.10),
# so there is no DynamoDB table to provision or pay for.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "rooferslabs"
      ManagedBy = "terraform"
      Component = "tfstate"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  # Bucket names are globally unique across all AWS accounts, so the account id
  # is what keeps this from colliding with someone else's.
  bucket_name = "rooferslabs-terraform-state-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name

  # State is the only record of what production is. Refuse to delete the bucket
  # while it holds anything, and refuse to let Terraform destroy it at all.
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    # Every apply overwrites the state object. Versioning is what makes a bad
    # apply recoverable: the previous state is one `aws s3api get-object
    # --version-id` away.
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# State objects hold every credential in both environments in plaintext. Refuse
# any request that is not TLS — the one control that costs nothing and closes
# the whole class of transport-level exposure.
data "aws_iam_policy_document" "state" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json
}

# Old state versions accumulate forever otherwise. 90 days is well past any
# window in which rolling one back is still the right move.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
