import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import Devices from './Devices.vue';
import type { DeviceModel } from '../composables/useDevices';

// Shared reactive mocks
const mockDevices = ref<DeviceModel[]>([]);
const mockLoading = ref(false);
const mockError = ref<string | null>(null);
const mockFetchDevices = vi.fn();

const mockIsAuthenticated = ref(false);

// Reservations composable mocks (Devices.vue uses these!)
const mockReservations = ref<any[]>([]);
const mockReservationsLoading = ref(false);
const mockReservationsError = ref<string | null>(null);
const mockFetchMyReservations = vi.fn();

// Add reservation mocks
const mockAddReservation = vi.fn();
const mockReserving = ref(false);
const mockReserveError = ref<string | null>(null);

// Cancel reservation mocks
const mockCancelReservation = vi.fn();
const mockCancelling = ref(false);
const mockCancelError = ref<string | null>(null);

// Telemetry
const trackPageView = vi.fn();

// Mocks
vi.mock('@/composables/useDevices', () => ({
  useDevices: () => ({
    devices: mockDevices,
    loading: mockLoading,
    error: mockError,
    fetchDevices: (...args: any[]) => mockFetchDevices(...args),
  }),
}));

vi.mock('@auth0/auth0-vue', () => ({
  useAuth0: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

vi.mock('@/composables/useReservations', () => ({
  useReservations: () => ({
    reservations: mockReservations,
    loading: mockReservationsLoading,
    error: mockReservationsError,
    fetchMyReservations: (...args: any[]) => mockFetchMyReservations(...args),
  }),
}));

vi.mock('@/composables/useAddReservations', () => ({
  useAddReservations: () => ({
    addReservation: (...args: any[]) => mockAddReservation(...args),
    loading: mockReserving,
    error: mockReserveError,
  }),
}));

vi.mock('@/composables/useCancelReservations', () => ({
  useCancelReservations: () => ({
    cancelReservation: (...args: any[]) => mockCancelReservation(...args),
    loading: mockCancelling,
    error: mockCancelError,
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

    mockReservations.value = [];
    mockReservationsLoading.value = false;
    mockReservationsError.value = null;

    mockReserving.value = false;
    mockReserveError.value = null;

    mockCancelling.value = false;
    mockCancelError.value = null;

    mockFetchDevices.mockReset();
    mockFetchMyReservations.mockReset();
    mockAddReservation.mockReset();
    mockCancelReservation.mockReset();
  });

  it('calls fetchDevices on mount (and tracks page view)', async () => {
    // Act
    mount(Devices);
    await flushPromises();

    // Assert
    expect(trackPageView).toHaveBeenCalledWith('Devices', expect.any(String));
    expect(mockFetchDevices).toHaveBeenCalledTimes(1);
    expect(mockFetchDevices).toHaveBeenCalledWith();
  });

  it('when authenticated, also fetches my reservations on mount', async () => {
    // Arrange
    mockIsAuthenticated.value = true;

    // Act
    mount(Devices);
    await flushPromises();

    // Assert
    expect(mockFetchDevices).toHaveBeenCalledTimes(2);
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockFetchDevices).toHaveBeenCalledWith();

    expect(mockFetchMyReservations).toHaveBeenCalledTimes(2);
    expect(mockFetchMyReservations).toHaveBeenCalledWith(true);
    expect(mockFetchMyReservations).toHaveBeenCalledWith();
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
    await flushPromises();

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
    // Arrange (NOTE: modelId not id)
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
      },
      {
        modelId: 'm2',
        brand: 'Canon',
        model: 'EOS',
        category: 'Camera',
        price: 200,
        description: 'Photo',
      },
    ] as any;

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
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        availableCount: 3,
      },
    ] as any;

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
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        availableCount: 3,
      },
    ] as any;

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
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        price: 100,
        description: 'Nice',
        // availableCount omitted -> (undefined ?? 0) => 0
      },
    ] as any;

    // Act
    const wrapper = mount(Devices);

    // Assert
    expect(wrapper.text()).toContain('currently available: 0');
  });
});
