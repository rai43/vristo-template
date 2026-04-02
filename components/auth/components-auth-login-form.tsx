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
import Swal from 'sweetalert2';

// Validation schema with Yup
const loginSchema = Yup.object().shape({
    email: Yup.string().email('Invalid email format').required('Email is required'),
    password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const ComponentsAuthLoginForm = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [showPassword, setShowPassword] = useState(false);
    const { isLoading, error } = useSelector((state: IRootState) => state.auth);

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
        },
        validationSchema: loginSchema,
        onSubmit: async (values) => {
            try {
                // Clear any previous errors
                dispatch(clearError() as any);

                // Dispatch login action
                const result = await dispatch(loginUser(values) as any);

                if (loginUser.fulfilled.match(result)) {
                    // Success notification
                    await Swal.fire({
                        icon: 'success',
                        title: 'Welcome Back!',
                        text: 'Login successful',
                        timer: 1500,
                        showConfirmButton: false,
                    });

                    // Redirect to dashboard
                    router.push('/');
                } else {
                    // Error notification
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Failed',
                        text: (result.payload as string) || 'Invalid credentials',
                        confirmButtonText: 'Try Again',
                    });
                }
            } catch (err) {
                console.error('Login error:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An unexpected error occurred',
                    confirmButtonText: 'OK',
                });
            }
        },
    });

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <form className="space-y-5 dark:text-white" onSubmit={formik.handleSubmit}>
            {/* Email Field */}
            <div>
                <label htmlFor="email" className="text-sm font-medium">
                    Email
                </label>
                <div className="relative text-white-dark">
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter Email"
                        className={`form-input ps-10 placeholder:text-white-dark ${formik.touched.email && formik.errors.email ? 'border-danger' : ''}`}
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconMail fill={true} />
                    </span>
                </div>
                {formik.touched.email && formik.errors.email && <p className="mt-1 text-xs text-danger">{formik.errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
                <label htmlFor="password" className="text-sm font-medium">
                    Password
                </label>
                <div className="relative text-white-dark">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter Password"
                        className={`form-input pe-10 ps-10 placeholder:text-white-dark ${formik.touched.password && formik.errors.password ? 'border-danger' : ''}`}
                        value={formik.values.password}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconLockDots fill={true} />
                    </span>
                    <button type="button" className="absolute end-4 top-1/2 -translate-y-1/2" onClick={togglePasswordVisibility}>
                        {showPassword ? <IconEyeSlash /> : <IconEye />}
                    </button>
                </div>
                {formik.touched.password && formik.errors.password && <p className="mt-1 text-xs text-danger">{formik.errors.password}</p>}
            </div>

            {/* Global Error Message */}
            {error && (
                <div className="rounded-md bg-danger-light p-3 text-danger dark:bg-danger-dark-light">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isLoading || !formik.isValid}
                className="btn btn-gradient !mt-6 w-full border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isLoading ? (
                    <span className="inline-flex items-center">
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

export default ComponentsAuthLoginForm;
