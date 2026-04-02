'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArticleCategory, registrationsApi } from '@/lib/api/article-registrations';
import { Customer, getCustomer, getCustomers } from '@/lib/api/clients';
import { getOrder, getOrders, Order } from '@/lib/api/orders';
import Swal from 'sweetalert2';

const RegistrationFlow = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [articleCategories, setArticleCategories] = useState<ArticleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const fetchCustomer = useCallback(async (id: string) => {
    const data = await getCustomer(id);
    setCustomerData(data);
  }, []);

  const fetchOrder = useCallback(async (id: string) => {
    const data = await getOrder(id);
    setOrderData(data);
  }, []);

  const { data: customers } = useQuery(['customers'], getCustomers);
  const { data: orders } = useQuery(['orders'], getOrders);

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    const orderId = searchParams.get('orderId');

    if (customerId) {
      fetchCustomer(customerId);
    }

    if (orderId) {
      fetchOrder(orderId);
    }
  }, [fetchCustomer, fetchOrder, searchParams]);

  useEffect(() => {
    if (customerData) {
      setStep(2);
    }
  }, [customerData]);

  useEffect(() => {
    if (orderData) {
      setStep(3);
    }
  }, [orderData]);

  const handleCategorySelect = (category: ArticleCategory) => {
    setSelectedCategory(category);
  };

  const handleRegistration = async () => {
    if (!selectedCategory) return;

    try {
      await registrationsApi.registerArticle({
        category: selectedCategory,
        customer: customerData!,
        order: orderData!,
      });
      setRegistrationSuccess(true);
      Swal.fire('Success', 'Registration completed successfully!', 'success');
    } catch (error) {
      Swal.fire('Error', 'Registration failed. Please try again.', 'error');
    }
  };

  const handleReset = () => {
    setStep(1);
    setCustomerData(null);
    setOrderData(null);
    setSelectedCategory(null);
    setRegistrationSuccess(false);
    queryClient.invalidateQueries(['customers', 'orders']);
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h2>Step 1: Select Customer</h2>
          <select
            onChange={(e) => {
              const customerId = e.target.value;
              const selectedCustomer = customers?.find((c) => c.id === customerId);
              setCustomerData(selectedCustomer || null);
            }}
          >
            <option value="">-- Select a Customer --</option>
            {customers?.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 2 && customerData && (
        <div>
          <h2>Step 2: Select Order for {customerData.name}</h2>
          <select
            onChange={(e) => {
              const orderId = e.target.value;
              const selectedOrder = orders?.find((o) => o.id === orderId);
              setOrderData(selectedOrder || null);
            }}
          >
            <option value="">-- Select an Order --</option>
            {orders?.map((order) => (
              <option key={order.id} value={order.id}>
                {order.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 3 && orderData && (
        <div>
          <h2>Step 3: Select Article Category for Order {orderData.description}</h2>
          <div>
            {articleCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category)}
                style={{
                  backgroundColor: selectedCategory?.id === category.id ? 'lightblue' : 'white',
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
          <button onClick={handleRegistration}>Register Article</button>
        </div>
      )}

      {registrationSuccess && (
        <div>
          <h2>Registration Successful!</h2>
          <button onClick={handleReset}>Start New Registration</button>
        </div>
      )}

      <button onClick={handleReset}>Reset</button>
    </div>
  );
};

export default RegistrationFlow;
