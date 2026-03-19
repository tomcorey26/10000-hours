'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLogin, useSignup } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import { useHaptics } from '@/hooks/use-haptics';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof signupSchema>;

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
    resolver: standardSchemaResolver(isLogin ? loginSchema : signupSchema),
    mode: 'onBlur',
  });

  const login = useLogin();
  const signup = useSignup();
  const mutation = isLogin ? login : signup;

  function onSubmit(data: FormData) {
    clearErrors('root');
    mutation.mutate(data, {
      onSuccess: () => {
        trigger('success');
        router.push('/skills');
      },
      onError: (err) => {
        trigger('error');
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setError('email', { message: 'An account with this email already exists' });
          } else if (err.status === 401) {
            setError('root', { message: 'Invalid email or password' });
          } else {
            setError('root', { message: err.message });
          }
        } else {
          setError('root', { message: 'Something went wrong. Please try again.' });
        }
      },
    });
  }

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
              ? 'Sign in to continue tracking your progress'
              : 'Start tracking your 10,000 hours'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="bg-background"
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="bg-background"
              />
              {errors.password ? (
                <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>
              ) : !isLogin ? (
                <p className="text-sm text-muted-foreground">Must be at least 8 characters</p>
              ) : null}
            </div>
            {errors.root && (
              <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{errors.root.message}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? '...' : isLogin ? 'Sign In' : 'Sign Up'}
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
