/**
 * User Identity Hook
 *
 * Manages user identity across the application:
 * - Generates and stores UUID for anonymous users
 * - Syncs with backend location consent API
 * - Persists user_id in localStorage
 * - Tracks user role (victim/responder)
 */

import { useState, useEffect } from 'react';
import { createOrUpdateUserLocation, type LocationConsentResponse } from '@/services/api';

const USER_ID_KEY = 'beacon_user_id';
const USER_ROLE_KEY = 'beacon_user_role';
const USER_DATA_KEY = 'beacon_user_data';

export type UserRole = 'victim' | 'responder';

export interface UserIdentity {
  userId: string | null;
  role: UserRole | null;
  userData: LocationConsentResponse | null;
  isRegistered: boolean;
}

export interface UseUserIdentityReturn {
  identity: UserIdentity;
  registerUser: (
    role: UserRole,
    latitude: number,
    longitude: number,
    options?: {
      name?: string;
      contactInfo?: string;
      helperSkills?: string[];
      helperMaxRange?: number;
    }
  ) => Promise<LocationConsentResponse>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  clearIdentity: () => void;
  isLoading: boolean;
  error: Error | null;
}

export function useUserIdentity(): UseUserIdentityReturn {
  const [identity, setIdentity] = useState<UserIdentity>({
    userId: localStorage.getItem(USER_ID_KEY),
    role: localStorage.getItem(USER_ROLE_KEY) as UserRole | null,
    userData: null,
    isRegistered: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load user data from localStorage on mount
  useEffect(() => {
    const storedData = localStorage.getItem(USER_DATA_KEY);
    if (storedData) {
      try {
        const userData = JSON.parse(storedData);
        setIdentity(prev => ({
          ...prev,
          userData,
          isRegistered: true,
        }));
      } catch (err) {
        console.error('Failed to parse stored user data:', err);
      }
    }
  }, []);

  /**
   * Register user with backend and store identity
   */
  const registerUser = async (
    role: UserRole,
    latitude: number,
    longitude: number,
    options: {
      name?: string;
      contactInfo?: string;
      helperSkills?: string[];
      helperMaxRange?: number;
    } = {}
  ): Promise<LocationConsentResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get existing user_id from storage or let backend generate new one
      const existingUserId = localStorage.getItem(USER_ID_KEY);

      const response = await createOrUpdateUserLocation({
        user_id: existingUserId,
        latitude,
        longitude,
        name: options.name || null,
        contact_info: options.contactInfo || null,
        is_helper: role === 'responder',
        helper_skills: options.helperSkills || null,
        helper_max_range: options.helperMaxRange || null,
      });

      // Store in localStorage
      localStorage.setItem(USER_ID_KEY, response.user_id);
      localStorage.setItem(USER_ROLE_KEY, role);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(response));

      // Update state
      setIdentity({
        userId: response.user_id,
        role,
        userData: response,
        isRegistered: true,
      });

      return response;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register user');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update user location (for location tracking)
   */
  const updateLocation = async (latitude: number, longitude: number): Promise<void> => {
    if (!identity.userId || !identity.role) {
      throw new Error('User not registered. Call registerUser first.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await createOrUpdateUserLocation({
        user_id: identity.userId,
        latitude,
        longitude,
        is_helper: identity.role === 'responder',
        // Preserve existing data
        name: identity.userData?.name || null,
        contact_info: identity.userData?.contact_info || null,
        helper_skills: identity.userData?.helper_skills || null,
        helper_max_range: identity.userData?.helper_max_range || null,
      });

      // Update stored data
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(response));

      setIdentity(prev => ({
        ...prev,
        userData: response,
      }));

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update location');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear identity (logout)
   */
  const clearIdentity = () => {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_DATA_KEY);

    setIdentity({
      userId: null,
      role: null,
      userData: null,
      isRegistered: false,
    });
  };

  return {
    identity,
    registerUser,
    updateLocation,
    clearIdentity,
    isLoading,
    error,
  };
}
