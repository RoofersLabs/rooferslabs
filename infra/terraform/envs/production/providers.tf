terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }

  # ---- Remote state ---------------------------------------------------------
  # Still local, and that is now the single largest risk to this environment:
  # terraform.tfstate exists only on one laptop, is gitignored, and contains
  # every credential in plaintext. Losing it means production can no longer be
  # planned or modified by Terraform at all — only rebuilt by importing dozens
  # of live resources by hand. It also makes CI-driven Terraform impossible,
  # which is what a two-environment split needs.
  #
  # Migrate deliberately, and only AFTER `terraform plan` has confirmed the
  # modules/platform refactor is a no-op against the local state:
  #
  #   1. terraform plan                    # expect 0 to add/change/destroy
  #   2. cd ../../bootstrap && terraform init && terraform apply
  #   3. uncomment the block below
  #   4. terraform init -migrate-state
  #
  # The key is per-environment: development writes to development/terraform.
  # tfstate under the same bucket, so neither environment's state is readable
  # or writable by the other's IAM role.
  #
  # backend "s3" {
  #   bucket       = "rooferslabs-terraform-state-462292557780"
  #   key          = "production/terraform.tfstate"
  #   region       = "us-east-1"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rooferslabs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront ACM certificates must live in us-east-1, regardless of the primary
# region. Used by the frontend-cdn module for the SPA certificate.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "rooferslabs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
