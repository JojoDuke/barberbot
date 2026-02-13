import { businesses, type Business } from '../../../config/businesses';

interface ReservioRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  queryParams?: Record<string, string>;
}

export class ReservioClient {
  private baseUrl = 'https://api.reservio.com/v2';

  private getToken(business: Business): string {
    const token = process.env[business.tokenEnvVar];
    if (!token) {
      throw new Error(
        `Missing Reservio token for ${business.name}. Please set ${business.tokenEnvVar} in .env file`
      );
    }
    return token;
  }

  async request<T>(
    business: Business,
    endpoint: string,
    options: ReservioRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, queryParams } = options;
    const token = this.getToken(business);

    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.api+json',
    };

    if (body) {
      headers['Content-Type'] = 'application/vnd.api+json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Reservio API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }

  // Business methods
  async getBusiness(businessId: string) {
    const business = Object.values(businesses).find(b => b.id === businessId);
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found in configuration`);
    }

    return this.request(business, `/businesses/${businessId}`);
  }

  // Services methods
  async getServices(businessId: string) {
    const business = Object.values(businesses).find(b => b.id === businessId);
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found in configuration`);
    }

    return this.request(business, `/businesses/${businessId}/services`);
  }

  // Availability methods
  async getAvailability(
    businessId: string,
    serviceId: string,
    from: string,
    to: string,
    resourceId?: string
  ) {
    const business = Object.values(businesses).find(b => b.id === businessId);
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found in configuration`);
    }

    const queryParams: Record<string, string> = {
      'filter[from]': from,
      'filter[to]': to,
      'filter[serviceId]': serviceId,
    };

    if (resourceId) {
      queryParams['filter[resourceId]'] = resourceId;
    }

    return this.request(
      business,
      `/businesses/${businessId}/availability/booking-slots`,
      { queryParams }
    );
  }

  // Booking methods
  async createBooking(
    businessId: string,
    bookingData: {
      clientName: string;
      clientEmail: string;
      clientPhone: string;
      serviceId: string;
      start: string;
      end: string;
      note?: string;
    }
  ) {
    const business = Object.values(businesses).find(b => b.id === businessId);
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found in configuration`);
    }

    const body = {
      data: {
        type: 'booking',
        attributes: {
          bookedClientName: bookingData.clientName,
          note: bookingData.note || '',
          via: 'application',
        },
        relationships: {
          event: {
            data: {
              type: 'event',
              attributes: {
                start: bookingData.start,
                end: bookingData.end,
                name: bookingData.clientName,
                eventType: 'appointment',
              },
              relationships: {
                service: {
                  data: {
                    type: 'service',
                    id: bookingData.serviceId,
                  },
                },
              },
            },
          },
          client: {
            data: {
              type: 'client',
              attributes: {
                name: bookingData.clientName,
                email: bookingData.clientEmail,
                phone: bookingData.clientPhone,
              },
            },
          },
        },
      },
    };

    return this.request(
      business,
      `/businesses/${businessId}/bookings`,
      { method: 'POST', body }
    );
  }
}

// Singleton instance
export const reservioClient = new ReservioClient();

