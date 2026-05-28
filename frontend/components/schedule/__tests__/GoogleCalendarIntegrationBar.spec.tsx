import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoogleCalendarIntegrationBar } from '../GoogleCalendarIntegrationBar';

describe('GoogleCalendarIntegrationBar', () => {
  it('does not render for standalone teams', () => {
    const { container } = render(
      <GoogleCalendarIntegrationBar
        status={{ status: 'not_applicable' }}
        isLoading={false}
        isLeader={true}
        isStarting={false}
        isDisconnecting={false}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows connected status and disconnect action for leaders', () => {
    const onDisconnect = vi.fn();

    render(
      <GoogleCalendarIntegrationBar
        status={{
          status: 'connected',
          connectedAt: '2026-05-28T04:00:00.000Z',
          googleAccountEmail: 'leader@example.com',
          googleCalendarId: 'primary',
        }}
        isLoading={false}
        isLeader={true}
        isStarting={false}
        isDisconnecting={false}
        lastFetchedAt={Date.parse('2026-05-28T05:00:00.000Z')}
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      />
    );

    expect(screen.getByText('leader@example.com')).toBeTruthy();
    expect(screen.getByText('연결됨')).toBeTruthy();
    fireEvent.click(screen.getByText('해제'));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('shows connect action for consent-required leaders', () => {
    const onConnect = vi.fn();

    render(
      <GoogleCalendarIntegrationBar
        status={{ status: 'needs_consent' }}
        isLoading={false}
        isLeader={true}
        isStarting={false}
        isDisconnecting={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('연결'));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('keeps connected status visually successful even when schedule sync failed', () => {
    const { container } = render(
      <GoogleCalendarIntegrationBar
        status={{ status: 'connected', googleAccountEmail: 'leader@example.com' }}
        isLoading={false}
        isLeader={false}
        isStarting={false}
        isDisconnecting={false}
        lastScheduleSync={{ attempted: true, success: false, error: 'quota exceeded' }}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText('leader@example.com')).toBeTruthy();
    expect(screen.getByText('연결됨')).toBeTruthy();
    expect(screen.queryByText(/quota exceeded/)).toBeNull();
    expect(container.firstChild).toHaveClass('bg-emerald-50');
    expect(container.firstChild).not.toHaveClass('bg-amber-50');
  });
});
