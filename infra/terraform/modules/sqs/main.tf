# =============================================================================
# SQS — background jobs queue + dead-letter queue
# =============================================================================
# Provisioned so background processing can be enabled without another
# infrastructure migration. The application currently processes post-call
# work inline (BACKGROUND_JOBS_INLINE=true); no consumer exists yet, so the
# queue simply stands ready. Messages that fail maxReceiveCount deliveries
# land in the DLQ for inspection.

resource "aws_sqs_queue" "dead_letter" {
  name                      = "${var.name}-jobs-dlq"
  message_retention_seconds = 14 * 24 * 60 * 60 # keep failures for 14 days
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${var.name}-jobs"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = 4 * 24 * 60 * 60
  receive_wait_time_seconds  = 20 # long polling for future consumers
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = var.max_receive_count
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "dead_letter" {
  queue_url = aws_sqs_queue.dead_letter.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.jobs.arn]
  })
}
