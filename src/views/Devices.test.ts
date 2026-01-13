import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
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
  let localeSpy: ReturnType<typeof vi.spyOn> | undefined;

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

    // Make date formatting deterministic across environments.
    localeSpy = vi
      .spyOn(Date.prototype, 'toLocaleString')
      .mockImplementation(() => 'Mon 01 Jan 00:00');
  });

  afterEach(() => {
    localeSpy?.mockRestore();
  });

  it('calls fetchDevices on mount (and tracks page view)', async () => {
    mount(Devices);
    await flushPromises();

    expect(trackPageView).toHaveBeenCalledWith('Devices', expect.any(String));
    expect(mockFetchDevices).toHaveBeenCalledTimes(1);
    expect(mockFetchDevices).toHaveBeenCalledWith();
  });

  it('when authenticated, also fetches my reservations on mount', async () => {
    mockIsAuthenticated.value = true;

    mount(Devices);
    await flushPromises();

    expect(mockFetchDevices).toHaveBeenCalledTimes(2);
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockFetchDevices).toHaveBeenCalledWith();

    expect(mockFetchMyReservations).toHaveBeenCalledTimes(2);
    expect(mockFetchMyReservations).toHaveBeenCalledWith(true);
    expect(mockFetchMyReservations).toHaveBeenCalledWith();
  });

  it('shows loading state', () => {
    mockLoading.value = true;

    const wrapper = mount(Devices);

    expect(wrapper.find('.state--loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading devices');
  });

  it('shows error state and retries with force=true', async () => {
    mockError.value = 'Boom';

    const wrapper = mount(Devices);
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.find('.state--error').exists()).toBe(true);
    expect(wrapper.text()).toContain('Boom');
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
  });

  it('shows empty state when no devices', () => {
    mockDevices.value = [];

    const wrapper = mount(Devices);

    expect(wrapper.find('.state--empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('No devices are configured');
  });

  it('renders devices list', () => {
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

    const wrapper = mount(Devices);

    const cards = wrapper.findAll('.device-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain('Apple MacBook');
    expect(cards[1].text()).toContain('Canon EOS');
  });

  it('when logged out, prompts sign-in instead of availability counts', () => {
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

    const wrapper = mount(Devices);

    expect(wrapper.text()).toContain(
      'Sign in to see how many are currently available',
    );
    expect(wrapper.text()).not.toContain('currently available: 3');
  });

  it('when logged in, shows availability count', () => {
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

    const wrapper = mount(Devices);

    expect(wrapper.text()).toContain('currently available: 3');
  });

  it('when logged in and availableCount is 0 or undefined, shows "currently available: 0"', () => {
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

    const wrapper = mount(Devices);

    expect(wrapper.text()).toContain('currently available: 0');
  });

  it('shows reservations loading state for authenticated users', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 3,
      },
    ] as any;
    mockReservationsLoading.value = true;

    const wrapper = mount(Devices);
    await flushPromises();

    expect(wrapper.text()).toContain('Loading your reservations');
  });

  it('shows reservations error state for authenticated users', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 3,
      },
    ] as any;
    mockReservationsError.value = 'Reservations backend down';

    const wrapper = mount(Devices);
    await flushPromises();

    expect(wrapper.text()).toContain('Reservations backend down');
  });

  it('shows reserved state including reservedAt and due date (valid date)', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 0,
      },
    ] as any;
    mockReservations.value = [
      {
        id: 'r1',
        deviceModelId: 'm1',
        status: 'reserved',
        reservedAt: '2025-01-01T10:00:00.000Z',
      },
    ];

    const wrapper = mount(Devices);
    await flushPromises();

    expect(wrapper.text()).toContain('You’ve reserved this device model');
    expect(wrapper.text()).toContain('Reserved at: Mon 01 Jan 00:00');
    expect(wrapper.text()).toContain('Due back: Mon 01 Jan 00:00');
    expect(wrapper.text()).toContain('(2 days)');
    expect(wrapper.find('button').text()).toContain('Cancel reservation');
  });

  it('shows "Unknown" for reservedAt/dueAt when date is invalid', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 0,
      },
    ] as any;
    mockReservations.value = [
      {
        id: 'r1',
        deviceModelId: 'm1',
        status: 'reserved',
        reservedAt: 'not-a-date',
      },
    ];

    const wrapper = mount(Devices);
    await flushPromises();

    expect(wrapper.text()).toContain('Reserved at: Unknown');
    expect(wrapper.text()).toContain('Due back: Unknown');
  });

  it('reserve button is disabled when no availability', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 0,
      },
    ] as any;

    const wrapper = mount(Devices);
    await flushPromises();

    const btn = wrapper.find('button');
    expect(btn.text()).toContain('Reserve');
    expect((btn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking Reserve calls addReservation and refreshes devices+reservations when created', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 2,
      },
    ] as any;
    mockAddReservation.mockResolvedValue(true);

    const wrapper = mount(Devices);
    await flushPromises();

    mockFetchDevices.mockClear();
    mockFetchMyReservations.mockClear();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mockAddReservation).toHaveBeenCalledWith({ deviceModelId: 'm1' });
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockFetchMyReservations).toHaveBeenCalledWith(true);
  });

  it('clicking Reserve does not refresh when addReservation returns falsy', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 2,
      },
    ] as any;
    mockAddReservation.mockResolvedValue(false);

    const wrapper = mount(Devices);
    await flushPromises();

    mockFetchDevices.mockClear();
    mockFetchMyReservations.mockClear();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mockAddReservation).toHaveBeenCalledWith({ deviceModelId: 'm1' });
    expect(mockFetchDevices).not.toHaveBeenCalled();
    expect(mockFetchMyReservations).not.toHaveBeenCalled();
  });

  it('clicking Cancel calls cancelReservation and refreshes devices+reservations when ok', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 0,
      },
    ] as any;
    mockReservations.value = [
      {
        id: 'r1',
        deviceModelId: 'm1',
        status: 'reserved',
        reservedAt: '2025-01-01T10:00:00.000Z',
      },
    ];
    mockCancelReservation.mockResolvedValue(true);

    const wrapper = mount(Devices);
    await flushPromises();

    mockFetchDevices.mockClear();
    mockFetchMyReservations.mockClear();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mockCancelReservation).toHaveBeenCalledWith('r1');
    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockFetchMyReservations).toHaveBeenCalledWith(true);
  });

  it('shows reserveError and cancelError messages when present', async () => {
    mockIsAuthenticated.value = true;
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 2,
      },
    ] as any;
    mockReserveError.value = 'No availability';
    mockCancelError.value = 'Cancel failed';

    const wrapper = mount(Devices);
    await flushPromises();

    expect(wrapper.text()).toContain('No availability');
    expect(wrapper.text()).toContain('Cancel failed');
  });

  it('reacts to auth changes: refreshes and clears reservations on logout', async () => {
    mockIsAuthenticated.value = true;
    mockReservations.value = [
      {
        id: 'r1',
        deviceModelId: 'm1',
        status: 'reserved',
        reservedAt: '2025-01-01T10:00:00.000Z',
      },
    ];
    mockDevices.value = [
      {
        modelId: 'm1',
        brand: 'Apple',
        model: 'MacBook',
        category: 'Laptop',
        description: 'Nice',
        availableCount: 1,
      },
    ] as any;

    mount(Devices);
    await flushPromises();

    mockFetchDevices.mockClear();
    mockFetchMyReservations.mockClear();

    // Logout
    mockIsAuthenticated.value = false;
    await nextTick();
    await flushPromises();

    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockReservations.value).toEqual([]);

    // Login again triggers reservation refresh
    mockFetchDevices.mockClear();
    mockFetchMyReservations.mockClear();
    mockIsAuthenticated.value = true;
    await nextTick();
    await flushPromises();

    expect(mockFetchDevices).toHaveBeenCalledWith(true);
    expect(mockFetchMyReservations).toHaveBeenCalledWith(true);
  });
});
