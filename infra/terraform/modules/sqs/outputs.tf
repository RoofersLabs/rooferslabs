output "queue_url" {
  value = aws_sqs_queue.jobs.url
}

output "queue_arn" {
  value = aws_sqs_queue.jobs.arn
}

output "dead_letter_queue_url" {
  value = aws_sqs_queue.dead_letter.url
}

output "dead_letter_queue_arn" {
  value = aws_sqs_queue.dead_letter.arn
}
