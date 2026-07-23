'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getMessages, type Locale } from '@/i18n';
import {
  allowedStatusTransitions,
  statusTransitionRequiresReason,
  updateIncidentAssignment,
  updateIncidentStatus,
  type WorkflowMutationResult,
} from '@/lib/admin-incident-workflow-api';
import type { AdminIncidentStatus, EligibleAssignee } from '@/lib/admin-incidents-api';

type WorkflowRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST';

function errorMessage(
  result: Exclude<WorkflowMutationResult, { kind: 'success' }>,
  messages: ReturnType<typeof getMessages>['admin']['incidents']['workflow'],
): string {
  if (result.kind === 'conflict') return messages.conflict;
  if (result.kind === 'unauthenticated') return messages.sessionExpired;
  if (result.kind === 'forbidden') return messages.forbidden;
  return messages.updateFailed;
}

export function AdminIncidentWorkflowControls({
  locale,
  incidentId,
  status,
  assignedToUserId,
  updatedAt,
  role,
  eligibleAssignees,
}: Readonly<{
  locale: Locale;
  incidentId: string;
  status: AdminIncidentStatus;
  assignedToUserId: string | null;
  updatedAt: string;
  role: WorkflowRole;
  eligibleAssignees: readonly EligibleAssignee[];
}>) {
  const router = useRouter();
  const messages = getMessages(locale).admin.incidents;
  const workflow = messages.workflow;
  const canChangeStatus = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
  const canAssign = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const nextStatuses = allowedStatusTransitions[status];
  const [nextStatus, setNextStatus] = useState<AdminIncidentStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [statusConfirmed, setStatusConfirmed] = useState(false);
  const [assignee, setAssignee] = useState(assignedToUserId ?? '');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [unassignConfirmed, setUnassignConfirmed] = useState(false);
  const [pending, setPending] = useState<'status' | 'assignment' | null>(null);
  const [notice, setNotice] = useState('');
  const reasonRequired = nextStatus !== '' && statusTransitionRequiresReason(status, nextStatus);
  const confirmationRequired = nextStatus === 'CLOSED' || nextStatus === 'REJECTED';

  async function submitStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (
      !nextStatus ||
      (reasonRequired && !statusReason.trim()) ||
      (confirmationRequired && !statusConfirmed)
    ) {
      setNotice(
        reasonRequired && !statusReason.trim() ? workflow.requiredReason : workflow.confirmRequired,
      );
      return;
    }
    setPending('status');
    const result = await updateIncidentStatus(incidentId, {
      toStatus: nextStatus,
      ...(statusReason.trim() ? { reason: statusReason } : {}),
      expectedUpdatedAt: updatedAt,
    });
    setPending(null);
    if (result.kind === 'success') {
      setNotice(workflow.updateSuccessful);
      router.refresh();
    } else {
      setNotice(errorMessage(result, workflow));
    }
  }

  async function submitAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    const target = assignee || null;
    if (target === assignedToUserId) {
      setNotice(workflow.noAssignmentChange);
      return;
    }
    if (target === null && !unassignConfirmed) {
      setNotice(workflow.confirmRequired);
      return;
    }
    setPending('assignment');
    const result = await updateIncidentAssignment(incidentId, {
      assignedToUserId: target,
      ...(assignmentReason.trim() ? { reason: assignmentReason } : {}),
      expectedUpdatedAt: updatedAt,
    });
    setPending(null);
    if (result.kind === 'success') {
      setNotice(workflow.updateSuccessful);
      router.refresh();
    } else {
      setNotice(errorMessage(result, workflow));
    }
  }

  if (!canChangeStatus && !canAssign) return null;

  return (
    <section className="admin-detail-card admin-workflow" aria-labelledby="workflow-title">
      <h2 id="workflow-title">{workflow.title}</h2>
      <p>{workflow.description}</p>
      <div className="admin-workflow-grid">
        {canChangeStatus ? (
          <form onSubmit={submitStatus}>
            <fieldset disabled={pending !== null}>
              <legend>{workflow.changeStatus}</legend>
              <label>
                {workflow.nextStatus}
                <select
                  value={nextStatus}
                  onChange={(event) => {
                    setNextStatus(event.target.value as AdminIncidentStatus | '');
                    setStatusConfirmed(false);
                  }}
                  required
                >
                  <option value="">{workflow.chooseStatus}</option>
                  {nextStatuses.map((next) => (
                    <option key={next} value={next}>
                      {messages.status[next]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {workflow.transitionReason}
                <textarea
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  maxLength={1000}
                  required={reasonRequired}
                  aria-invalid={reasonRequired && !statusReason.trim() ? true : undefined}
                />
              </label>
              {reasonRequired ? <p className="field-help">{workflow.requiredReason}</p> : null}
              {confirmationRequired ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={statusConfirmed}
                    onChange={(event) => setStatusConfirmed(event.target.checked)}
                  />
                  {nextStatus === 'CLOSED' ? workflow.confirmClose : workflow.confirmReject}
                </label>
              ) : null}
              <button type="submit" className="button">
                {pending === 'status' ? workflow.updating : workflow.changeStatus}
              </button>
            </fieldset>
          </form>
        ) : null}

        {canAssign ? (
          <form onSubmit={submitAssignment}>
            <fieldset disabled={pending !== null}>
              <legend>{workflow.assignIncident}</legend>
              <label>
                {workflow.chooseAssignee}
                <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                  <option value="">{workflow.unassigned}</option>
                  {eligibleAssignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {workflow.assignmentReason}
                <textarea
                  value={assignmentReason}
                  onChange={(event) => setAssignmentReason(event.target.value)}
                  maxLength={1000}
                />
              </label>
              {!assignee && assignedToUserId ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={unassignConfirmed}
                    onChange={(event) => setUnassignConfirmed(event.target.checked)}
                  />
                  {workflow.confirmUnassign}
                </label>
              ) : null}
              <button type="submit" className="button">
                {pending === 'assignment' ? workflow.updating : workflow.assignIncident}
              </button>
            </fieldset>
          </form>
        ) : null}
      </div>
      <p className="admin-workflow-notice" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
