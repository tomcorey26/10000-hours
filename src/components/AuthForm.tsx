'use client';
'use no memo'; // react-hook-form uses mutable refs incompatible with React Compiler

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePasskeyLogin, usePasskeyRegister } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import { useHaptics } from '@/hooks/use-haptics';

const usernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
});

type FormData = z.infer<typeof usernameSchema>;

export function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const { trigger } = useHaptics();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(usernameSchema),
    mode: 'onBlur',
  });

  const login = usePasskeyLogin();
  const signup = usePasskeyRegister();

  function onSubmit(data: FormData) {
    clearErrors('root');
    if (isLogin) {
      login.mutate(data.username, {
        onSuccess: () => {
          trigger('success');
          router.push('/habits');
        },
        onError: (err) => {
          trigger('error');
          if (err instanceof ApiError) {
            setError('root', { message: err.message });
          } else {
            setError('root', { message: 'Something went wrong. Please try again.' });
          }
        },
      });
    } else {
      signup.mutate({ username: data.username }, {
        onSuccess: () => {
          trigger('success');
          router.push('/habits');
        },
        onError: (err) => {
          trigger('error');
          if (err instanceof ApiError) {
            if (err.status === 409) {
              setError('username', { message: 'This username is already taken' });
            } else {
              setError('root', { message: err.message });
            }
          } else {
            setError('root', { message: 'Something went wrong. Please try again.' });
          }
        },
      });
    }
  }

  const isPending = login.isPending || signup.isPending;

  function toggleMode() {
    trigger('selection');
    setIsLogin(!isLogin);
    reset();
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-[15vh] px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? 'Sign in with your passkey'
              : 'Start tracking your 10,000 hours'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username webauthn"
                {...register('username')}
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'username-error' : undefined}
                className="bg-background"
              />
              {errors.username && (
                <p id="username-error" className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            {errors.root && (
              <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{errors.root.message}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={toggleMode} className="underline text-primary">
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
