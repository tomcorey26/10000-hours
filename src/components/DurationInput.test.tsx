// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DurationInput } from './DurationInput';

describe('DurationInput', () => {
  // ─── Happy path ───

  it('renders minutes and seconds inputs with labels', () => {
    render(<DurationInput minutes={25} seconds={0} onChange={() => {}} />);
    expect(screen.getByLabelText('min')).toBeInTheDocument();
    expect(screen.getByLabelText('sec')).toBeInTheDocument();
  });

  it('displays initial minutes and zero-padded seconds', () => {
    render(<DurationInput minutes={25} seconds={5} onChange={() => {}} />);
    expect(screen.getByLabelText('min')).toHaveValue('25');
    expect(screen.getByLabelText('sec')).toHaveValue('05');
  });

  it('calls onChange when minutes are typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.type(minInput, '10');

    expect(onChange).toHaveBeenLastCalledWith({ minutes: 10, seconds: 0 });
  });

  it('calls onChange when seconds are typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.type(secInput, '30');

    expect(onChange).toHaveBeenLastCalledWith({ minutes: 5, seconds: 30 });
  });

  it('displays colon separator between inputs', () => {
    render(<DurationInput minutes={0} seconds={0} onChange={() => {}} />);
    expect(screen.getByText(':')).toBeInTheDocument();
  });

  // ─── Input validation (bad paths) ───

  it('strips non-numeric characters from minutes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.type(minInput, 'abc');

    // non-numeric input should not produce a meaningful change
    // The input value should remain empty or 0
    expect(minInput).not.toHaveValue('abc');
  });

  it('strips non-numeric characters from seconds', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.type(secInput, 'xy');

    expect(secInput).not.toHaveValue('xy');
  });

  it('caps minutes at 3 digits', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.type(minInput, '9999');

    expect(minInput).toHaveValue('999');
  });

  it('caps seconds at 2 digits in the input', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.type(secInput, '999');

    // maxLength 2 means only first 2 chars accepted
    expect(secInput).toHaveValue('99');
  });

  it('clamps seconds to 59 on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.type(secInput, '99');
    await user.tab(); // blur

    expect(secInput).toHaveValue('59');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 0, seconds: 59 });
  });

  it('pads seconds to 2 digits on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.type(secInput, '5');
    await user.tab(); // blur

    expect(secInput).toHaveValue('05');
  });

  it('defaults empty minutes to 0 on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={25} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.tab(); // blur

    expect(minInput).toHaveValue('0');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 0, seconds: 0 });
  });

  // ─── Edge cases ───

  it('handles 0 minutes and 0 seconds', () => {
    render(<DurationInput minutes={0} seconds={0} onChange={() => {}} />);
    expect(screen.getByLabelText('min')).toHaveValue('0');
    expect(screen.getByLabelText('sec')).toHaveValue('00');
  });

  it('removes leading zeros from minutes display', async () => {
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={() => {}} />);

    const minInput = screen.getByLabelText('min');
    await user.clear(minInput);
    await user.type(minInput, '05');

    // Leading zero should be stripped: "05" → "5"
    expect(minInput).toHaveValue('5');
  });

  it('resets display when remounted with new props via key', () => {
    const { rerender } = render(
      <DurationInput key="10-30" minutes={10} seconds={30} onChange={() => {}} />
    );
    expect(screen.getByLabelText('min')).toHaveValue('10');
    expect(screen.getByLabelText('sec')).toHaveValue('30');

    rerender(<DurationInput key="45-15" minutes={45} seconds={15} onChange={() => {}} />);
    expect(screen.getByLabelText('min')).toHaveValue('45');
    expect(screen.getByLabelText('sec')).toHaveValue('15');
  });

  // ─── Arrow key increment/decrement ───

  it('increments minutes with ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.click(minInput);
    await user.keyboard('{ArrowUp}');

    expect(minInput).toHaveValue('6');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 6, seconds: 0 });
  });

  it('decrements minutes with ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.click(minInput);
    await user.keyboard('{ArrowDown}');

    expect(minInput).toHaveValue('4');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 4, seconds: 0 });
  });

  it('does not decrement minutes below 0', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.click(minInput);
    await user.keyboard('{ArrowDown}');

    expect(minInput).toHaveValue('0');
  });

  it('does not increment minutes above 999', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={999} seconds={0} onChange={onChange} />);

    const minInput = screen.getByLabelText('min');
    await user.click(minInput);
    await user.keyboard('{ArrowUp}');

    expect(minInput).toHaveValue('999');
  });

  it('increments seconds with ArrowUp', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={10} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.click(secInput);
    await user.keyboard('{ArrowUp}');

    expect(secInput).toHaveValue('11');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 5, seconds: 11 });
  });

  it('decrements seconds with ArrowDown', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={10} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.click(secInput);
    await user.keyboard('{ArrowDown}');

    expect(secInput).toHaveValue('09');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 5, seconds: 9 });
  });

  it('does not decrement seconds below 0', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.click(secInput);
    await user.keyboard('{ArrowDown}');

    expect(secInput).toHaveValue('00');
  });

  it('does not increment seconds above 59', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={59} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.click(secInput);
    await user.keyboard('{ArrowUp}');

    expect(secInput).toHaveValue('59');
  });

  // ─── Shift-left behavior ───

  it('shifts left when typing into a full seconds field', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={12} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    // cursor at end of "12", type "3" → should become "23"
    await user.click(secInput);
    await user.type(secInput, '3');

    expect(secInput).toHaveValue('23');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 0, seconds: 23 });
  });

  it('shifts left multiple times in seconds', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={0} seconds={0} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.click(secInput);
    // "00" → type "1" → "01" → type "5" → "15"
    await user.type(secInput, '15');

    expect(secInput).toHaveValue('15');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 0, seconds: 15 });
  });

  it('handles empty seconds as 00 on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DurationInput minutes={5} seconds={30} onChange={onChange} />);

    const secInput = screen.getByLabelText('sec');
    await user.clear(secInput);
    await user.tab(); // blur

    expect(secInput).toHaveValue('00');
    expect(onChange).toHaveBeenLastCalledWith({ minutes: 5, seconds: 0 });
  });
});
