import { Injectable, Logger } from '@nestjs/common';
import type { $Enums, Call } from '@prisma/client';
import {
  CallStatus,
  ConversationOutcome,
  NotificationPriority,
  NotificationType,
  type ConversationStructuredOutput,
  type TranscriptEntry,
  type UrgencyLevel,
} from '@rooferslabs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { ReceptionistService } from '../receptionist/receptionist.service';
import type { LiveConversationSignals } from '../receptionist/session-state';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TwilioService } from '../telephony/twilio.service';

export interface CreateInboundCallInput {
  companyId: string;
  phoneNumberId?: string | null;
  twilioCallSid?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  forwardedFrom?: string | null;
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
    private readonly twilio: TwilioService,
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
        forwardedFrom: input.forwardedFrom ?? null,
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
    const conversationId = await this.persist(
      call.id,
      companyId,
      customer?.id ?? null,
      structured,
      input,
    );

    // 4. Notify the team (outside the transaction).
    await this.notify(companyId, conversationId, structured, input.signals);

    // 5. Best-effort SMS: lead alert to the owner, acknowledgement to the caller.
    await this.sendSmsNotifications(companyId, call.fromNumber, structured);
  }

  /**
   * Post-call SMS, sent from the company's dedicated AI number. Both messages
   * are best-effort: failures are logged and never affect the stored call data.
   */
  private async sendSmsNotifications(
    companyId: string,
    callerNumber: string | null,
    structured: ConversationStructuredOutput,
  ): Promise<void> {
    if (!this.twilio.isSmsEnabled) return;
    if (structured.outcome === ConversationOutcome.SPAM) return;

    try {
      const [company, aiNumber] = await Promise.all([
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { name: true, phone: true },
        }),
        this.prisma.phoneNumber.findFirst({
          where: { companyId, status: { in: ['ASSIGNED', 'ACTIVE'] } },
        }),
      ]);
      if (!company || !aiNumber) return;

      const actionable =
        structured.emergency.isEmergency ||
        structured.appointment.requested ||
        structured.outcome === ConversationOutcome.LEAD_CAPTURED;

      // Owner alert — only for actionable outcomes, so the owner's phone is
      // not flooded by every wrong-number call.
      if (actionable && company.phone && company.phone !== aiNumber.phoneNumber) {
        const who = structured.customer.fullName ?? structured.customer.phone ?? 'A caller';
        const kind = structured.emergency.isEmergency
          ? '🚨 EMERGENCY call'
          : structured.appointment.requested
            ? 'New appointment request'
            : 'New lead';
        const callback = structured.customer.phone ?? callerNumber;
        await this.twilio.sendSms({
          to: company.phone,
          from: aiNumber.phoneNumber,
          body:
            `${kind} — ${who}${callback ? ` (${callback})` : ''}. ` +
            `${structured.summary}`.slice(0, 480) +
            ' — via RoofersLabs',
        });
      }

      // Caller acknowledgement — confirms their request was received.
      const ackTo = callerNumber ?? structured.customer.phone;
      if (actionable && ackTo) {
        await this.twilio.sendSms({
          to: ackTo,
          from: aiNumber.phoneNumber,
          body:
            `Thanks for calling ${company.name}! We received your request and ` +
            `our team will follow up shortly.`,
        });
      }
    } catch (error) {
      this.logger.warn(`Post-call SMS failed: ${(error as Error).message}`);
    }
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
    signals?: LiveConversationSignals,
  ): Promise<void> {
    const related = { type: 'conversation', id: conversationId };
    const message = buildLeadSummaryMessage(structured, signals);

    try {
      if (structured.emergency.isEmergency) {
        await this.notifications.create({
          companyId,
          type: NotificationType.EMERGENCY,
          priority: NotificationPriority.CRITICAL,
          title: `🚨 Emergency — ${structured.serviceType ?? structured.emergency.reason ?? 'urgent roofing issue'}`,
          message,
          relatedEntity: related,
        });
      } else if (structured.appointment.requested) {
        await this.notifications.create({
          companyId,
          type: NotificationType.APPOINTMENT_REQUEST,
          priority: NotificationPriority.HIGH,
          title: `Appointment request — ${structured.appointment.serviceRequested ?? 'visit'}`,
          message,
          relatedEntity: related,
        });
      } else if (structured.outcome === ConversationOutcome.LEAD_CAPTURED) {
        await this.notifications.create({
          companyId,
          type: NotificationType.NEW_LEAD,
          priority: NotificationPriority.NORMAL,
          title: `New lead — ${structured.customer.fullName ?? 'caller'}`,
          message,
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

/**
 * A lead summary the owner can act on straight from the notification, without
 * opening the app. Lines with no data are omitted.
 */
export function buildLeadSummaryMessage(
  structured: ConversationStructuredOutput,
  signals?: LiveConversationSignals,
): string {
  const insurance = signals?.customer.insuranceClaim;
  const requested = [
    structured.appointment.preferredDate,
    structured.appointment.preferredTimeWindow,
  ]
    .filter(Boolean)
    .join(', ');

  const lines: (string | null)[] = [
    `Customer: ${structured.customer.fullName ?? 'Unknown'}`,
    structured.customer.phone ? `Phone: ${structured.customer.phone}` : null,
    structured.serviceType ? `Problem: ${structured.serviceType}` : null,
    `Priority: ${humanizeUrgency(structured.urgency)}`,
    structured.appointment.requested ? `Requested visit: ${requested || 'Team to schedule'}` : null,
    `Insurance: ${insurance ? insurance.charAt(0).toUpperCase() + insurance.slice(1) : 'Unknown'}`,
    structured.customer.propertyAddress ? `Location: ${structured.customer.propertyAddress}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

function humanizeUrgency(urgency: UrgencyLevel): string {
  const lower = String(urgency).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
