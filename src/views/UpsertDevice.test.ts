import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import UpsertDevices from './UpsertDevices.vue';
import type { UpsertDevicesCommand } from '../composables/useUpsertDevices.ts';

// Auth0 mocks
const mockIsAuthenticated = ref(false);
const mockLoginWithRedirect = vi.fn();
const mockUser = ref<any | null>(null);

// useUpsertDevices mocks
const mockUpsertDevices = vi.fn();
const mockLoading = ref(false);
const mockError = ref<string | null>(null);
const mockSuccess = ref(false);

const trackPageView = vi.fn();

vi.mock('@auth0/auth0-vue', () => ({
  useAuth0: () => ({
    isAuthenticated: mockIsAuthenticated,
    loginWithRedirect: mockLoginWithRedirect,
    user: mockUser,
  }),
}));

vi.mock('@/composables/useUpsertDevices', () => ({
  useUpsertDevices: () => ({
    upsertDevices: mockUpsertDevices,
    loading: mockLoading,
    error: mockError,
    success: mockSuccess,
  }),
}));

vi.mock('@/composables/useTelemetry', () => ({
  useTelemetry: () => ({
    trackPageView,
  }),
}));

describe('UpsertDevices.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.value = false;
    mockUser.value = null;

    mockLoading.value = false;
    mockError.value = null;
    mockSuccess.value = false;

    mockUpsertDevices.mockResolvedValue(undefined);
  });

  it('when not authenticated, shows sign-in prompt and calls loginWithRedirect', async () => {
    // Arrange
    mockIsAuthenticated.value = false;

    // Act
    const wrapper = mount(UpsertDevices);
    await wrapper.find('button').trigger('click');

    // Assert
    expect(wrapper.text()).toContain('You need to sign in');
    expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('when authenticated but not staff, shows forbidden message', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockUser.value = { 'https://example.com/roles': ['student'] };

    // Act
    const wrapper = mount(UpsertDevices);

    // Assert
    expect(wrapper.text()).toContain('do not have permission to add devices');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('when staff, renders form', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockUser.value = { 'https://example.com/roles': ['staff'] };

    // Act
    const wrapper = mount(UpsertDevices);

    // Assert
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.text()).toContain('Add Device');
  });

  it('submits form and calls upsertDevices with command', async () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockUser.value = { 'https://example.com/roles': ['staff'] };

    const wrapper = mount(UpsertDevices);

    // Act: fill a few fields
    await wrapper
      .find('input[placeholder="e.g. macbook-air-m1"]')
      .setValue('macbook-air-m1');
    await wrapper.find('input[placeholder="e.g. Apple"]').setValue('Apple');
    await wrapper
      .find('input[placeholder="e.g. MacBook Air M1"]')
      .setValue('MacBook Air M1');
    await wrapper.find('input[placeholder="e.g. Laptop"]').setValue('Laptop');
    await wrapper.find('input[type="number"]').setValue('999');
    await wrapper.find('textarea').setValue('Short desc');
    await wrapper.find('select').setValue('retired');

    await wrapper.find('form').trigger('submit');

    // Assert
    expect(mockUpsertDevices).toHaveBeenCalledTimes(1);

    const arg = mockUpsertDevices.mock.calls[0][0] as UpsertDevicesCommand;
    expect(arg).toMatchObject({
      id: 'macbook-air-m1',
      brand: 'Apple',
      model: 'MacBook Air M1',
      category: 'Laptop',
      price: 999,
      description: 'Short desc',
      status: 'retired',
    });
  });

  it('shows error message when error exists', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockUser.value = { 'https://example.com/roles': ['staff'] };
    mockError.value = 'Bad input';

    // Act
    const wrapper = mount(UpsertDevices);

    // Assert
    expect(wrapper.text()).toContain('Bad input');
  });

  it('shows success message when success=true', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockUser.value = { 'https://example.com/roles': ['staff'] };
    mockSuccess.value = true;

    // Act
    const wrapper = mount(UpsertDevices);

    // Assert
    expect(wrapper.text()).toContain('Device added successfully');
  });
});
