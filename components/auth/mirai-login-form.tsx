'use client';
import IconLockDots from '@/components/icon/icon-lock-dots';
import IconMail from '@/components/icon/icon-mail';
import IconEye from '@/components/icon/icon-eye';
import IconEyeSlash from '@/components/icon/icon-eye-slash';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '@/store/authSlice';
import { IRootState } from '@/store';

const MiraiLoginForm = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { isLoading } = useSelector((state: IRootState) => state.auth);

    const loginSchema = Yup.object().shape({
        email: Yup.string().email('Invalid email address').required('Email is required'),
        password: Yup.string().required('Password is required'),
    });

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
        },
        validationSchema: loginSchema,
        onSubmit: async (values, { setSubmitting }) => {
            setError('');
            setSuccess('');

            try {
                // Clear any previous errors
                dispatch(clearError() as any);

                // Dispatch login action
                const result = await dispatch(
                    loginUser({
                        email: values.email.toLowerCase(),
                        password: values.password,
                    }) as any
                );

                if (loginUser.fulfilled.match(result)) {
                    setSuccess('Login successful! Redirecting to dashboard...');
                    // Small delay to show success message
                    setTimeout(() => {
                        router.push('/');
                    }, 800);
                } else {
                    const errorMessage = (result.payload as string) || 'Login failed. Please check your credentials and try again.';
                    setError(errorMessage);
                }
            } catch (err: any) {
                console.error('Login error:', err);
                setError('An unexpected error occurred. Please try again.');
            } finally {
                setSubmitting(false);
            }
        },
    });

    return (
        <form className="space-y-5 dark:text-white" onSubmit={formik.handleSubmit}>
            {error && (
                <div className="flex items-center rounded-lg border border-red-500 bg-red-50 p-3.5 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    <span className="ltr:pr-2 rtl:pl-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                            <path opacity="0.5" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" />
                            <path d="M12 8V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="12" cy="16" r="1" fill="currentColor" />
                        </svg>
                    </span>
                    <span className="flex-1">
                        <strong className="font-bold">Authentication Error: </strong>
                        {error}
                    </span>
                </div>
            )}

            {success && (
                <div className="flex items-center rounded-lg border border-green-500 bg-green-50 p-3.5 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    <span className="ltr:pr-2 rtl:pl-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" />
                            <path d="M10.75 15.5L16 10L14.875 8.875L10.75 13.125L9.125 11.5L8 12.625L10.75 15.5Z" fill="white" />
                        </svg>
                    </span>
                    <span className="flex-1">
                        <strong className="font-bold">Success: </strong>
                        {success}
                    </span>
                </div>
            )}

            <div>
                <label htmlFor="email">Email Address</label>
                <div className="relative text-white-dark">
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        className={`form-input ps-10 placeholder:text-white-dark ${formik.touched.email && formik.errors.email ? 'border-red-500' : ''}`}
                        value={formik.values.email}
                        onChange={(e) => {
                            // Auto-convert email to lowercase
                            formik.setFieldValue('email', e.target.value.toLowerCase());
                        }}
                        onBlur={formik.handleBlur}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconMail fill={true} />
                    </span>
                </div>
                {formik.touched.email && formik.errors.email && (
                    <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {formik.errors.email}
                    </div>
                )}
            </div>

            <div>
                <label htmlFor="password">Password</label>
                <div className="relative text-white-dark">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className={`form-input pe-10 ps-10 placeholder:text-white-dark ${formik.touched.password && formik.errors.password ? 'border-red-500' : ''}`}
                        value={formik.values.password}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                formik.handleSubmit();
                            }
                        }}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconLockDots fill={true} />
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-4 top-1/2 -translate-y-1/2 text-white-dark transition hover:text-primary focus:outline-none"
                        tabIndex={-1}
                    >
                        {showPassword ? <IconEyeSlash className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                    </button>
                </div>
                {formik.touched.password && formik.errors.password && (
                    <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {formik.errors.password}
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={isLoading || formik.isSubmitting || !formik.isValid}
                className="btn !mt-6 w-full border-0 uppercase shadow-[0_10px_20px_-10px_rgba(139,69,19,0.44)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                    background: isLoading || formik.isSubmitting ? 'linear-gradient(135deg, #a0522d 0%, #8b4513 100%)' : 'linear-gradient(135deg, #8b4513 0%, #7a3f10 100%)',
                }}
            >
                {isLoading || formik.isSubmitting ? (
                    <span className="flex items-center justify-center">
                        <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                    </span>
                ) : (
                    'Sign in'
                )}
            </button>
        </form>
    );
};

export default MiraiLoginForm;
