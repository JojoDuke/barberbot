
import { getBusinessById, type Business } from '../../../config/businesses';
import { logApi } from '../../logger';

const BASE_URL = 'https://api.reservanto.cz/v1';

export class ReservantoClient {
    private ltt: string;
    private cachedSTT: string | null = null;
    private sttExpiresAt: number = 0;

    constructor(ltt: string) {
        this.ltt = ltt;
    }

    private async getSTT(): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        if (this.cachedSTT && now < this.sttExpiresAt) return this.cachedSTT;

        const res = await fetch(`${BASE_URL}/Authorize/GetShortTimeToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ LongTimeToken: this.ltt, TimeStamp: now }),
        });

        const data = await res.json() as { ShortTimeToken: string; IsError: boolean; ErrorMessage?: string };

        if (data.IsError || !data.ShortTimeToken) {
            throw new Error(`Reservanto auth failed: ${data.ErrorMessage || 'Unknown error'}`);
        }

        this.cachedSTT = data.ShortTimeToken;
        this.sttExpiresAt = now + 25 * 60; // cache 25 min
        return this.cachedSTT;
    }
    // ... (rest of the class remains the same but using this.post)
    // Actually I need to make sure post uses this.getSTT which it already does.
    // I will replace the global functions at the end too.

    // ──────────────────────────────────────────────
    // Generic POST helper
    // ──────────────────────────────────────────────

    private async post<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
        const stt = await this.getSTT();
        const now = Math.floor(Date.now() / 1000);

        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': stt,
            },
            body: JSON.stringify({ ...body, TimeStamp: now }),
        });

        if (!res.ok) {
            const text = await res.text();
            logApi('Reservanto', 'POST', endpoint, { status: res.status, error: text, body }, true);
            throw new Error(`Reservanto API error (${res.status}) on ${endpoint}: ${text}`);
        }

        const data = await res.json() as { IsError: boolean; ErrorMessage?: string } & T;
        if (data.IsError) {
            logApi('Reservanto', 'POST', endpoint, { error: data.ErrorMessage, body }, true);
            throw new Error(`Reservanto API error on ${endpoint}: ${data.ErrorMessage}`);
        }

        logApi('Reservanto', 'POST', endpoint, { body, hasResult: !!data });
        return data;
    }

    // ──────────────────────────────────────────────
    // Merchant info
    // ──────────────────────────────────────────────

    async getMerchantInfo() {
        return this.post<{
            Result: {
                Id: number;
                Name: string;
                ContactEmail: string;
                ContactPhone: string;
                Web: string;
                MailingAddress: {
                    Street: string;
                    City: string;
                    ZipCode: string;
                    Country: string;
                    Latitude: number;
                    Longitude: number;
                };
            };
        }>('/Merchant/GetInfo');
    }

    // ──────────────────────────────────────────────
    // Locations (branches)
    // ──────────────────────────────────────────────

    async getLocations(onlyPublic = false) {
        return this.post<{
            Items: Array<{
                Id: number;
                Name: string;
                Phone: string;
                Email: string;
                Description: string;
                Address: {
                    Street: string;
                    City: string;
                    ZipCode: string;
                    Country: string;
                    Latitude: number;
                    Longitude: number;
                };
                WorkingHours: Array<{ DayOfWeek: number; Start: number; End: number }>;
                State: string;
            }>;
        }>('/Location/GetList', { OnlyPublic: onlyPublic });
    }

    // ──────────────────────────────────────────────
    // Booking Resources (employees / chairs)
    // ──────────────────────────────────────────────

    async getBookingResources(locationId?: number, onlyPublic = false) {
        return this.post<{
            Items: Array<{
                Id: number;
                Name: string;
                Email: string;
                Phone: string;
                Description: string;
                LocationId: number;
                BookingServiceIds: number[];
                ImageUrl: string | null;
                State: string;
            }>;
        }>('/BookingResource/GetList', {
            LocationId: locationId ?? null,
            OnlyPublic: onlyPublic,
        });
    }

    // ──────────────────────────────────────────────
    // Services
    // ──────────────────────────────────────────────

    async getServices() {
        return this.post<{
            Items: Array<{
                Id: number;
                Name: string;
                Description: string;
                Duration: number;
                Price: number;
                Currency: string;
                State: string;
                BookingResourceIds: number[];
            }>;
        }>('/BookingService/GetList');
    }

    async getServicesForResource(bookingResourceId: number) {
        return this.post<{
            Items: Array<{
                Id: number;
                Name: string;
                Duration: number;
                Price: number;
                Currency: string;
                State: string;
            }>;
        }>('/BookingService/GetForBookingResource', { BookingResourceId: bookingResourceId });
    }

    // ──────────────────────────────────────────────
    // Availability
    // ──────────────────────────────────────────────

    async getAvailableSlots(
        bookingResourceId: number,
        bookingServiceId: number,
        intervalStart: Date,
        intervalEnd: Date
    ) {
        return this.post<{
            Starts: number[];
        }>('/OneToOne/GetAvailableStarts', {
            BookingResourceId: bookingResourceId,
            BookingServiceId: bookingServiceId,
            IntervalStart: Math.floor(intervalStart.getTime() / 1000),
            IntervalEnd: Math.floor(intervalEnd.getTime() / 1000),
        });
    }

    async getAvailableSlotsForLocation(
        locationId: number,
        bookingServiceId: number,
        intervalStart: Date,
        intervalEnd: Date
    ) {
        return this.post<{
            Starts: Array<{ Start: number; BookingResourceId: number }>;
        }>('/OneToOne/GetAvailableStartsForLocation', {
            LocationId: locationId,
            BookingServiceId: bookingServiceId,
            IntervalStart: Math.floor(intervalStart.getTime() / 1000),
            IntervalEnd: Math.floor(intervalEnd.getTime() / 1000),
        });
    }

    // ──────────────────────────────────────────────
    // Bookings / Reservations
    // ──────────────────────────────────────────────

    async createBooking(params: {
        bookingResourceId: number;
        bookingServiceId: number;
        customerId: number;
        bookingStart: Date;
        customerNote?: string;
        forceConfirmed?: boolean;
    }) {
        return this.post<{
            AppointmentId: number;
            CustomerId: number;
            Status: string;
            IsPaymentRequired: boolean;
        }>('/OneToOne/CreateBooking', {
            BookingResourceId: params.bookingResourceId,
            BookingServiceId: params.bookingServiceId,
            CustomerId: params.customerId,
            BookingStart: Math.floor(params.bookingStart.getTime() / 1000),
            CustomerNote: params.customerNote ?? '',
            ForceConfirmed: params.forceConfirmed ?? null,
        });
    }

    async getAvailableAppointments(params: {
        locationId: number;
        bookingServiceId?: number;
        intervalStart: Date;
        intervalEnd: Date;
    }) {
        return this.post<{
            Items: Array<{
                Id: number;
                Start: number;
                End: number;
                BookingResourceId: number;
                BookingServiceId: number;
                Capacity: number;
                ReservedCount: number;
            }>;
        }>('/Classes/GetAvailableAppointments', {
            LocationId: params.locationId,
            BookingServiceId: params.bookingServiceId || null,
            IntervalStart: Math.floor(params.intervalStart.getTime() / 1000),
            IntervalEnd: Math.floor(params.intervalEnd.getTime() / 1000),
        });
    }

    async createClassBooking(params: {
        appointmentId: number;
        customerId: number;
        count?: number;
        customerNote?: string;
    }) {
        return this.post<{
            AppointmentId: number;
            CustomerId: number;
            Status: string;
        }>('/Classes/CreateBooking', {
            AppointmentId: params.appointmentId,
            CustomerId: params.customerId,
            Count: params.count || 1,
            CustomerNote: params.customerNote || '',
        });
    }

    async cancelBooking(appointmentId: number, sendNotification = true) {
        return this.post('/Booking/Cancel', {
            AppointmentId: appointmentId,
            SendNotification: sendNotification,
        });
    }

    async getBookingsForPeriod(from: Date, to: Date) {
        return this.post<{
            Items: Array<{
                Id: number;
                Start: number;
                End: number;
                Status: string;
                CustomerId: number;
                BookingResourceId: number;
                BookingServiceId: number;
                CustomerNote: string;
            }>;
        }>('/Booking/GetBookingsForPeriod', {
            From: Math.floor(from.getTime() / 1000),
            To: Math.floor(to.getTime() / 1000),
        });
    }

    // ──────────────────────────────────────────────
    // Customers
    // ──────────────────────────────────────────────

    async findOrCreateCustomer(params: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
    }): Promise<number> {
        // First try to find by phone or email
        const searchRes: any = await this.post('/Customer/GetList', {
            Phone: params.phone || null,
            Email: params.email || null,
        }).catch(() => ({}));

        // Reservanto returns Customers (not Items) for this endpoint
        const customerList = (searchRes.Customers || searchRes.Items || []) as any[];

        // STRICT CHECK: The API might return all customers if no match is found.
        // We MUST verify that the email or phone actually matches.
        const matchedCustomer = customerList.find(c => {
            const emailMatch = params.email && c.Email && c.Email.toLowerCase() === params.email.toLowerCase();
            const phoneMatch = params.phone && c.Phone && c.Phone.replace(/\s+/g, '') === params.phone.replace(/\s+/g, '');
            return emailMatch || phoneMatch;
        });

        if (matchedCustomer) {
            return matchedCustomer.Id;
        }

        // Create new customer
        const createRes: any = await this.post('/Customer/Create', {
            FirstName: params.firstName,
            LastName: params.lastName,
            Email: params.email || null,
            Phone: params.phone || null,
        });

        // API may return Result.Id or Customers[0].Id or direct Id
        const newId =
            createRes?.Result?.Id ??
            createRes?.Customer?.Id ??
            createRes?.Customers?.[0]?.Id ??
            createRes?.Id;

        if (!newId) {
            throw new Error(`Failed to create customer: ${JSON.stringify(createRes)}`);
        }
        return newId;
    }
}

// Factory function to get client for a specific business
export async function getReservantoClient(businessId: string): Promise<ReservantoClient> {
    const business = await getBusinessById(businessId);
    if (!business) throw new Error(`Business ${businessId} not found`);

    const ltt = process.env[business.tokenEnvVar];
    if (!ltt) throw new Error(`Missing Reservanto LTT/token for ${business.name}. Please set ${business.tokenEnvVar} in .env file`);

    return new ReservantoClient(ltt);
}
