import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SignupForm } from '@/components/auth/SignupForm';
import { ApiError } from '@/lib/apiClient';

// Mock useSignup hook
const mockMutateAsync = vi.fn();
const mockUseSignup = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));

vi.mock('@/hooks/query/useAuth', () => ({
  useSignup: () => mockUseSignup(),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

function fillValidSignupForm() {
  fireEvent.change(screen.getByLabelText(/이름/i), { target: { value: '홍길동' } });
  fireEvent.change(screen.getByLabelText(/이메일/i), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText(/비밀번호/i), { target: { value: 'password123' } });
}

function agreeToTermsAndPrivacy() {
  fireEvent.click(screen.getByLabelText(/\[필수\] Team Works 이용약관에 동의합니다/i));
  fireEvent.click(screen.getByLabelText(/\[필수\] 개인정보 수집 및 이용에 동의합니다/i));
  fireEvent.click(screen.getByRole('button', { name: /동의하고 회원가입/i }));
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSignup.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders name, email, and password inputs with signup button', () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/이름/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /회원가입/i })).toBeInTheDocument();
  });

  it('disables submit button when form is empty', () => {
    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when all fields have values', () => {
    render(<SignupForm />);

    const nameInput = screen.getByLabelText(/이름/i);
    const emailInput = screen.getByLabelText(/이메일/i);
    const passwordInput = screen.getByLabelText(/비밀번호/i);

    fireEvent.change(nameInput, { target: { value: '홍길동' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /회원가입/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('shows name validation error when empty', async () => {
    render(<SignupForm />);

    const nameInput = screen.getByLabelText(/이름/i);

    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText(/이름을 입력해주세요/i)).toBeInTheDocument();
    });
  });

  it('shows name validation error when name exceeds 50 characters', async () => {
    render(<SignupForm />);

    const nameInput = screen.getByLabelText(/이름/i);

    fireEvent.change(nameInput, { target: { value: 'a'.repeat(51) } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText(/이름은 최대 50자까지 입력 가능합니다/i)).toBeInTheDocument();
    });
  });

  it('shows email validation error for invalid email', async () => {
    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/이메일/i);

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/올바른 이메일 형식이 아닙니다/i)).toBeInTheDocument();
    });
  });

  it('shows password validation error when password is less than 8 characters', async () => {
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText(/비밀번호/i);

    fireEvent.change(passwordInput, { target: { value: 'short1' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/비밀번호는 최소 8자 이상이어야 합니다/i)).toBeInTheDocument();
    });
  });

  it('shows password validation error when password has no number', async () => {
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText(/비밀번호/i);

    fireEvent.change(passwordInput, { target: { value: 'abcdefgh' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/비밀번호는 영문과 숫자를 포함해야 합니다/i)).toBeInTheDocument();
    });
  });

  it('shows password validation error when password has no letter', async () => {
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText(/비밀번호/i);

    fireEvent.change(passwordInput, { target: { value: '12345678' } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/비밀번호는 영문과 숫자를 포함해야 합니다/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data and redirects', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: '홍길동',
    };

    mockMutateAsync.mockResolvedValue({
      user: mockUser,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });

    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    expect(screen.getByRole('dialog', { name: /약관 및 개인정보 동의/i })).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: '홍길동',
        email: 'test@example.com',
        password: 'password123',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: '2026-06-02',
        privacyVersion: '2026-05-29',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message on 409 response (duplicate email)', async () => {
    mockMutateAsync.mockRejectedValue(new ApiError(409, 'Conflict'));

    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(screen.getByText(/이미 사용 중인 이메일입니다/i)).toBeInTheDocument();
    });
  });

  it('shows generic error message on other errors', async () => {
    mockMutateAsync.mockRejectedValue(new Error('서버 오류가 발생했습니다.'));

    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(screen.getByText(/서버 오류가 발생했습니다/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback after successful signup', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: '홍길동',
    };

    mockMutateAsync.mockResolvedValue({
      user: mockUser,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });

    const onSuccess = vi.fn();
    render(<SignupForm onSuccess={onSuccess} />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('sets auth cookie after successful signup', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: '홍길동',
    };

    mockMutateAsync.mockResolvedValue({
      user: mockUser,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });

    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(document.cookie).toContain('auth-initialized=true');
    });
  });

  it('disables inputs when signup is pending', () => {
    mockUseSignup.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    render(<SignupForm />);

    const nameInput = screen.getByLabelText(/이름/i);
    const emailInput = screen.getByLabelText(/이메일/i);
    const passwordInput = screen.getByLabelText(/비밀번호/i);

    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
  });

  it('shows loading text when signup is pending', () => {
    mockUseSignup.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    render(<SignupForm />);

    expect(screen.getByText(/회원가입 중/i)).toBeInTheDocument();
  });

  it('clears general error when user starts typing', async () => {
    mockMutateAsync.mockRejectedValue(new ApiError(409, 'Conflict'));

    render(<SignupForm />);

    // Submit to trigger error
    const emailInput = screen.getByLabelText(/이메일/i);
    const submitButton = screen.getByRole('button', { name: /회원가입/i });

    fillValidSignupForm();
    fireEvent.click(submitButton);
    agreeToTermsAndPrivacy();

    await waitFor(() => {
      expect(screen.getByText(/이미 사용 중인 이메일입니다/i)).toBeInTheDocument();
    });

    // Clear error by typing
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });

    await waitFor(() => {
      expect(screen.queryByText(/이미 사용 중인 이메일입니다/i)).not.toBeInTheDocument();
    });
  });
});
