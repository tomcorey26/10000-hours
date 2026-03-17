// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StartTimerModal } from './StartTimerModal';

vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

vi.mock('web-haptics/react', () => ({
  useWebHaptics: () => ({ trigger: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
});

function renderModal(overrides?: Partial<{ onStart: () => void; onCancel: () => void }>) {
  const onStart = overrides?.onStart ?? vi.fn();
  const onCancel = overrides?.onCancel ?? vi.fn();
  return { onStart, onCancel, ...render(
    <StartTimerModal habitName="Piano" onStart={onStart} onCancel={onCancel} />
  )};
}

describe('StartTimerModal', () => {
  // ─── Stopwatch mode (default) ───

  it('renders in stopwatch mode by default', () => {
    renderModal();
    expect(screen.getByText('Piano')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeEnabled();
  });

  it('calls onStart with no args in stopwatch mode', async () => {
    const user = userEvent.setup();
    const { onStart } = renderModal();

    await user.click(screen.getByText('Start'));

    expect(onStart).toHaveBeenCalledWith();
  });

  it('does not show duration inputs in stopwatch mode', () => {
    renderModal();
    expect(screen.queryByLabelText('min')).not.toBeInTheDocument();
  });

  // ─── Countdown mode ───

  it('shows duration inputs when switching to countdown', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Countdown'));

    expect(screen.getByLabelText('min')).toBeInTheDocument();
    expect(screen.getByLabelText('sec')).toBeInTheDocument();
  });

  it('shows presets in countdown mode', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Countdown'));

    expect(screen.getByText('15m')).toBeInTheDocument();
    expect(screen.getByText('25m')).toBeInTheDocument();
    expect(screen.getByText('60m')).toBeInTheDocument();
  });

  // ─── Disabled Start at 0:00 ───

  it('disables Start when countdown is 0:00', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Countdown'));

    // Clear the default 25 minutes to get to 0:00
    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab();

    expect(screen.getByText('Start')).toBeDisabled();
  });

  it('shows hint message when countdown is 0:00', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Countdown'));

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab();

    expect(screen.getByText('Set a duration to start')).toBeInTheDocument();
  });

  it('does not call onStart when Start is clicked at 0:00 countdown', async () => {
    const user = userEvent.setup();
    const { onStart } = renderModal();

    await user.click(screen.getByText('Countdown'));

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab();

    await user.click(screen.getByText('Start'));

    expect(onStart).not.toHaveBeenCalled();
  });

  it('enables Start when duration is set after being 0:00', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText('Countdown'));

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab();

    expect(screen.getByText('Start')).toBeDisabled();

    await user.type(minInput, '5');

    expect(screen.getByText('Start')).toBeEnabled();
    expect(screen.queryByText('Set a duration to start')).not.toBeInTheDocument();
  });

  // ─── Presets ───

  it('sets duration from preset and enables Start', async () => {
    const user = userEvent.setup();
    const { onStart } = renderModal();

    await user.click(screen.getByText('Countdown'));

    // Clear to 0:00 first
    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab();
    expect(screen.getByText('Start')).toBeDisabled();

    // Click a preset
    await user.click(screen.getByText('30m'));

    expect(screen.getByText('Start')).toBeEnabled();

    await user.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledWith(30 * 60);
  });

  // ─── Countdown calls onStart with seconds ───

  it('calls onStart with total seconds in countdown mode', async () => {
    const user = userEvent.setup();
    const { onStart } = renderModal();

    await user.click(screen.getByText('Countdown'));
    // Default is 25 min from DEFAULT_PREF
    await user.click(screen.getByText('Start'));

    expect(onStart).toHaveBeenCalledWith(25 * 60);
  });

  // ─── Cancel ───

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderModal();

    await user.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  // ─── Stopwatch is never disabled ───

  it('Start is always enabled in stopwatch mode', () => {
    renderModal();
    expect(screen.getByText('Start')).toBeEnabled();
    expect(screen.queryByText('Set a duration to start')).not.toBeInTheDocument();
  });
});
