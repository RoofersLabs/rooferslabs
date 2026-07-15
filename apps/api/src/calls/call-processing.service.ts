import { Injectable, Logger } from '@nestjs/common';
import type { $Enums, Call } from '@prisma/client';
import {
  CallStatus,
  ConversationOutcome,
  NotificationPriority,
  NotificationType,
  type ConversationStructuredOutput,
  type TranscriptEntry,
} from '@rooferslabs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { ReceptionistService } from '../receptionist/receptionist.service';
import type { LiveConversationSignals } from '../receptionist/session-state';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateInboundCallInput {
  companyId: string;
  phoneNumberId?: string | null;
  twilioCallSid?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
}

export interface FinalizeCallInput {
  transcript: TranscriptEntry[];
  signals: LiveConversationSignals;
  durationSeconds?: number;
  recordingUrl?: string | null;
  recordingKey?: string | null;
}

/**
 * Orchestrates the call lifecycle: create the inbound call record, then — when
 * the call ends — run AI analysis and atomically persist the conversation,
 * customer, appointment, and notifications (docs/02_System_Architecture §15).
 */
@Injectable()
export class CallProcessingService {
  private readonly logger = new Logger(CallProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receptionist: ReceptionistService,
    private readonly customers: CustomersService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Create the Call record when an inbound call connects. */
  createInboundCall(input: CreateInboundCallInput): Promise<Call> {
    return this.prisma.call.create({
      data: {
        company: { connect: { id: input.companyId } },
        ...(input.phoneNumberId ? { phoneNumber: { connect: { id: input.phoneNumberId } } } : {}),
        twilioCallSid: input.twilioCallSid ?? null,
        direction: 'INBOUND',
        fromNumber: input.fromNumber ?? null,
        toNumber: input.toNumber ?? null,
        status: CallStatus.IN_PROGRESS,
        startedAt: new Date(),
        answeredAt: new Date(),
      },
    });
  }

  /** Handle a Twilio status callback for a call that may never have streamed. */
  async handleStatusCallback(twilioCallSid: string, status: CallStatus): Promise<void> {
    const call = await this.prisma.call.findUnique({ where: { twilioCallSid } });
    if (call && call.status === CallStatus.IN_PROGRESS && status !== CallStatus.COMPLETED) {
      await this.markCallEnded(call.id, status);
    }
  }

  /** Mark a call that never produced a conversation as failed/missed. */
  async markCallEnded(callId: string, status: CallStatus): Promise<void> {
    await this.prisma.call
      .update({ where: { id: callId }, data: { status, endedAt: new Date() } })
      .catch(() => undefined);
  }

  /**
   * Finalize a completed call: analyze the transcript, upsert the customer, and
   * atomically persist the conversation (+ appointment), then notify the team.
   * Idempotent — a call that already has a conversation is skipped.
   */
  async finalizeCall(callId: string, input: FinalizeCallInput): Promise<void> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { conversation: { select: { id: true } } },
    });
    if (!call) throw new NotFoundError('Call not found.');
    if (call.conversation) {
      this.logger.debug(`Call ${callId} already finalized; skipping.`);
      return;
    }

    const companyId = call.companyId;

    // 1. AI analysis (external, slow — run before the DB transaction).
    const structured = await this.receptionist.analyzeConversation(
      companyId,
      input.transcript,
      input.signals,
    );

    // 2. Resolve/enrich the customer.
    const customer = await this.customers.upsertFromCall(companyId, {
      phone: structured.customer.phone ?? call.fromNumber,
      fullName: structured.customer.fullName,
      email: structured.customer.email,
      propertyAddress: structured.customer.propertyAddress,
      propertyType: structured.customer.propertyType,
    });

    // 3. Persist conversation + call update + appointment atomically.
    const conversationId = await this.persist(call.id, companyId, customer?.id ?? null, structured, input);

    // 4. Notify the team (outside the transaction).
    await this.notify(companyId, conversationId, structured);
  }

  private async persist(
    callId: string,
    companyId: string,
    customerId: string | null,
    structured: ConversationStructuredOutput,
    input: FinalizeCallInput,
  ): Promise<string> {
    return this.prisma.runInTransaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          company: { connect: { id: companyId } },
          call: { connect: { id: callId } },
          ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
          status: 'COMPLETED',
          outcome: structured.outcome as $Enums.ConversationOutcome,
          intent: structured.intent as $Enums.ConversationIntent,
          leadQuality: structured.leadQuality as $Enums.LeadQuality,
          urgency: structured.urgency as $Enums.UrgencyLevel,
          isEmergency: structured.emergency.isEmergency,
          transcript: input.transcript as unknown as object,
          summary: structured.summary,
          keyPoints: structured.keyPoints,
          structuredOutput: structured as unknown as object,
        },
      });

      await tx.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.COMPLETED,
          endedAt: new Date(),
          durationSeconds: input.durationSeconds ?? null,
          recordingUrl: input.recordingUrl ?? null,
          recordingKey: input.recordingKey ?? null,
          ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
        },
      });

      if (structured.appointment.requested) {
        await tx.appointment.create({
          data: {
            company: { connect: { id: companyId } },
            ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
            conversation: { connect: { id: conversation.id } },
            serviceRequested: structured.appointment.serviceRequested,
            propertyAddress: structured.customer.propertyAddress,
            preferredDate: parseDate(structured.appointment.preferredDate),
            preferredTimeWindow: structured.appointment.preferredTimeWindow,
            priority: structured.appointment.priority as $Enums.AppointmentPriority,
            notes: structured.appointment.notes,
            status: 'REQUESTED',
          },
        });
      }

      return conversation.id;
    });
  }

  private async notify(
    companyId: string,
    conversationId: string,
    structured: ConversationStructuredOutput,
  ): Promise<void> {
    const related = { type: 'conversation', id: conversationId };
    const customerName = structured.customer.fullName ?? 'A caller';

    try {
      if (structured.emergency.isEmergency) {
        await this.notifications.create({
          companyId,
          type: NotificationType.EMERGENCY,
          priority: NotificationPriority.CRITICAL,
          title: 'Emergency call',
          message: `${customerName} reported an emergency: ${structured.emergency.reason ?? 'urgent roofing issue'}.`,
          relatedEntity: related,
        });
      } else if (structured.appointment.requested) {
        await this.notifications.create({
          companyId,
          type: NotificationType.APPOINTMENT_REQUEST,
          priority: NotificationPriority.HIGH,
          title: 'New appointment request',
          message: `${customerName} requested ${structured.appointment.serviceRequested ?? 'a visit'}.`,
          relatedEntity: related,
        });
      } else if (structured.outcome === ConversationOutcome.LEAD_CAPTURED) {
        await this.notifications.create({
          companyId,
          type: NotificationType.NEW_LEAD,
          priority: NotificationPriority.NORMAL,
          title: 'New lead captured',
          message: `${customerName}: ${structured.summary}`.slice(0, 240),
          relatedEntity: related,
        });
      } else {
        await this.notifications.create({
          companyId,
          type: NotificationType.CALL_SUMMARY,
          priority: NotificationPriority.LOW,
          title: 'Call completed',
          message: structured.summary.slice(0, 240),
          relatedEntity: related,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to create notification: ${(error as Error).message}`);
    }
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
