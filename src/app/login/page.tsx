'use client';

import { Providers } from '@/components/Providers';
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <Providers>
      <AuthForm />
    </Providers>
  );
}
