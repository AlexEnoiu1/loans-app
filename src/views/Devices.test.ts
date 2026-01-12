import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import Devices from './Devices.vue';
import type { DeviceModel } from '../composables/useDevices';

// Mocks
let mockDevices = ref<DeviceModel[]>([]);
let mockLoading = ref(false);
let mockError = ref<string | null>(null);
let mockFetchDevices = vi.fn();

const mockIsAuthenticated = ref(false);

const trackPageView = vi.fn();

vi.mock('@/composables/useDevices', () => ({
  useDevices: () => ({
    devices: mockDevices,
    loading: mockLoading,
    error: mockError,
    fetchDevices: mockFetchDevices,
  }),
}));

vi.mock('@auth0/auth0-vue', () => ({
  useAuth0: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

vi.mock('@/composables/useTelemetry', () => ({
  useTelemetry: () => ({
    trackPageView,
  }),
}));

describe('Devices.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDevices.value = [];
    mockLoading.value = false;
    mockError.value = null;
    mockIsAuthenticated.value = false;
    mockFetchDevices = vi.fn();
  });

  it('calls fetchDevices on mount', () => {
    // Act
    mount(Devices);

    // Assert
    expect(trackPageView).toHaveBeenCalled();
    expect(mockFetchDevices).toHaveBeenCalledTimes(1);
    expect(mockFetchDevices).toHaveBeenCalledWith();
  });

  it('shows loading state', () => {
    // Arrange
    mockLoading.value = true;

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.find('.state--loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading devices');
  });

  it('shows error state and retries with force=true', async () => {
    // Arrange
    mockError.value = 'Boom';

    const wrapper = mount(Devices);

    // Act
    await wrapper.find('button').trigger('click');

    // Assert
    expect(wrapper.find('.state--error').exists()).toBe(true);
    expect(wrapper.text()).toContain('Boom');
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
  });

  it('shows empty state when no devices', () => {
    // Arrange
    mockDevices.value = [];

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.find('.state--empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('No devices are configured');
  });

  it('renders devices list', () => {
    // Arrange
    mockDevices.value = [
      {
        id: '1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
      },
      {
        id: '2',
        brand: 'Canon',
        model: 'EOS',
        category: 'Camera',
        price: 200,
        description: 'Photo',
      },
    ];

    // Act
    const wrapper = mount(Devices);

    // Assert
    const cards = wrapper.findAll('.device-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain('Apple MacBook');
    expect(cards[1].text()).toContain('Canon EOS');
  });

  it('when logged out, prompts sign-in instead of availability counts', () => {
    // Arrange
    mockIsAuthenticated.value = false;
    mockDevices.value = [
      {
        id: '1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        availableCount: 3,
      },
    ];

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.text()).toContain(
      'Sign in to see how many are currently available',
    );
    expect(wrapper.text()).not.toContain('currently available: 3');
  });

  it('when logged in, shows availability count', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        id: '1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        availableCount: 3,
      },
    ];

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.text()).toContain('currently available: 3');
  });

  it('when logged in and availableCount is 0 or undefined, shows "currently available: 0"', () => {
    // Arrange
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        id: '1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        // availableCount omitted -> (undefined ?? 0) => 0 -> else branch
      } as any,
    ];

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.text()).toContain('currently available: 0');
  });
});
