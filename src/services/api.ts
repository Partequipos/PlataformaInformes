import { Report, ReportFilters, PaginatedResponse, ApiResponse, User, LoginRequest, LoginResponse, CreateReportRequest, Resource, Parameter } from '../types';
import type { EquipmentAct } from '../constants/equipmentActs';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private token: string | null = null;

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    console.log('🔄 Processing response...');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);

    const rawText = await response.text();
    let data: ApiResponse<T> & { error?: string };

    try {
      data = rawText ? JSON.parse(rawText) : ({} as ApiResponse<T>);
      console.log('📊 Response data:', data);
    } catch {
      console.error('❌ Error parsing response JSON. Body preview:', rawText.slice(0, 200));
      if (response.status === 413) {
        throw new Error('Request too large (413). Please use fewer or smaller photos.');
      }
      if (response.status === 502 || response.status === 504 || response.status === 408) {
        throw new Error(
          'Server timeout while saving. Text may have been saved — refresh or save photos in smaller batches.'
        );
      }
      throw new Error(`Failed to parse response: HTTP ${response.status || 'unknown'}`);
    }

    if (!response.ok) {
      console.error('❌ API Error:', data);
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    console.log('🔗 Making login request...');
    console.log('📊 Login credentials:', credentials);
    console.log('🔗 API URL:', `${API_BASE_URL}/auth/login`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(credentials),
      });

      console.log('📡 Login response status:', response.status);
      console.log('📡 Login response ok:', response.ok);
      console.log('📡 Login response headers:', Object.fromEntries(response.headers.entries()));

      const result = await this.handleResponse<LoginResponse>(response);
      
      if (result.success && result.data) {
        this.token = result.data.token;
        // Store token in localStorage
        localStorage.setItem('authToken', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        console.log('✅ Login successful, token stored');
      }

      return result;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  async register(userData: { 
    username: string; 
    email: string; 
    password: string; 
    full_name: string; 
    role: string;
    zone?: string;
    brands?: string[];
    specialty?: string;
    rating?: number;
    cost_mtto_250h?: number;
    cost_mtto_500h?: number;
    cost_mtto_1000h?: number;
    cost_mtto_2000h?: number;
    cost_desplazamiento_km?: number;
    cost_hospedaje_dia?: number;
    cost_alimentacion_dia?: number;
    cost_hora_viaje_tecnico?: number;
    cost_valor_hora_mano_obra?: number;
    contact?: string;
    payment_method?: string;
  }): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });

    return this.handleResponse<User>(response);
  }

  async getProfile(): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<User>(response);
  }

  async updateProfile(updates: { 
    full_name: string; 
    email: string; 
    zone?: string;
    brands?: string[];
    specialty?: string;
    rating?: number;
    password?: string 
  }): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    return this.handleResponse<User>(response);
  }

  // Report methods
  async getReports(filters?: ReportFilters): Promise<PaginatedResponse<Report>> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.machineType) params.append('machineType', filters.machineType);
    if (filters?.clientName) params.append('clientName', filters.clientName);
    if (filters?.userFullName) params.append('userFullName', filters.userFullName);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.serialNumber) params.append('serialNumber', filters.serialNumber);
    if (filters?.general_status) params.append('general_status', filters.general_status);

    const response = await fetch(`${API_BASE_URL}/reports?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const result = await this.handleResponse<{
      reports: Report[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      };
    }>(response);

    if (result.success && result.data) {
      return {
        data: result.data.reports,
        total: result.data.pagination.totalCount,
        page: result.data.pagination.page,
        limit: result.data.pagination.limit,
        totalPages: result.data.pagination.totalPages,
      };
    }

    throw new Error('Failed to fetch reports');
  }

  async getReport(id: string): Promise<ApiResponse<Report>> {
    const response = await fetch(`${API_BASE_URL}/reports/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<Report>(response);
  }

  async createReport(reportData: FormData): Promise<ApiResponse<Report>> {
    console.log('🔗 Making API request to create report with FormData');
    console.log('🔑 Token:', this.token ? 'Present' : 'Missing');
    
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: headers,
      body: reportData,
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    return this.handleResponse<Report>(response);
  }

  async updateReport(id: string, updates: FormData): Promise<ApiResponse<Report>> {
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/reports/${id}`, {
      method: 'PUT',
      headers: headers,
      body: updates,
    });

    return this.handleResponse<Report>(response);
  }

  async deleteReport(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/reports/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  // Cerrar reporte
  async closeReport(id: string): Promise<ApiResponse<Report>> {
    const response = await fetch(`${API_BASE_URL}/reports/${id}/close`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    return this.handleResponse<Report>(response);
  }

  // File upload method
  async uploadFiles(files: File[]): Promise<ApiResponse<Array<{
    filename: string;
    original_name: string;
    file_path: string;
    mime_type: string;
  }>>> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    return this.handleResponse<Array<{
      filename: string;
      original_name: string;
      file_path: string;
      mime_type: string;
    }>>(response);
  }

  // Machine Types methods
  async getMachineTypes(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>>> {
    const response = await fetch(`${API_BASE_URL}/machine-types`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<Array<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>>(response);
  }

  async createMachineType(data: { name: string; description: string }): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await fetch(`${API_BASE_URL}/machine-types`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>(response);
  }

  async updateMachineType(id: string, data: { name: string; description: string }): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await fetch(`${API_BASE_URL}/machine-types/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>(response);
  }

  async deleteMachineType(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/machine-types/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  // Component Types methods
  async getComponentTypes(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>>> {
    const response = await fetch(`${API_BASE_URL}/component-types`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<Array<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>>(response);
  }

  async createComponentType(data: { name: string; description: string }): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await fetch(`${API_BASE_URL}/component-types`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>(response);
  }

  async updateComponentType(id: string, data: { name: string; description: string }): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await fetch(`${API_BASE_URL}/component-types/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<{
      id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }>(response);
  }

  async deleteComponentType(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/component-types/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  // Token management
  setToken(token: string) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  // Initialize token from localStorage
  initializeToken() {
    const token = localStorage.getItem('authToken');
    if (token) {
      this.token = token;
    }
  }

  async getAllUsers(): Promise<ApiResponse<User[]>> {
    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });
    return this.handleResponse<User[]>(response);
  }

  async getResources(): Promise<ApiResponse<Resource[]>> {
    const response = await fetch(`${API_BASE_URL}/resources`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<Resource[]>(response);
  }

  async createResource(data: { model: string; resource_name: string; resource_url: string; observation?: string }): Promise<ApiResponse<Resource>> {
    const response = await fetch(`${API_BASE_URL}/resources`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<Resource>(response);
  }

  async bulkImportResources(data: { csvData?: string; excelData?: string; fileType?: string; legacyFormat?: boolean }): Promise<ApiResponse<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors?: string[];
  }>> {
    const response = await fetch(`${API_BASE_URL}/resources/bulk-import`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<{
      totalProcessed: number;
      successCount: number;
      errorCount: number;
      errors?: string[];
    }>(response);
  }

  async deleteResource(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }

  async getParameters(): Promise<ApiResponse<Parameter[]>> {
    const response = await fetch(`${API_BASE_URL}/parameters`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<Parameter[]>(response);
  }

  async createParameter(data: { parameter: string; parameter_type: string; model: string; min_range: number; max_range: number; limit_range?: string; resource_url: string; observation?: string }): Promise<ApiResponse<Parameter>> {
    const response = await fetch(`${API_BASE_URL}/parameters`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<Parameter>(response);
  }

  async bulkImportParameters(data: { csvData?: string; excelData?: string; fileType?: string; legacyFormat?: boolean }): Promise<ApiResponse<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors?: string[];
  }>> {
    const response = await fetch(`${API_BASE_URL}/parameters/bulk-import`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<{
      totalProcessed: number;
      successCount: number;
      errorCount: number;
      errors?: string[];
    }>(response);
  }

  async deleteParameter(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/parameters/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  async deletePhoto(photoId: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/reports/photos/${photoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  async uploadComponentVideo(reportId: string, componentId: string, file: File): Promise<ApiResponse<boolean>> {
    const formData = new FormData();
    formData.append('componentId', componentId);
    formData.append('video', file, file.name);
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}/videos`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return this.handleResponse<boolean>(response);
  }

  async deleteVideo(videoId: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/reports/videos/${videoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<boolean>(response);
  }

  async updatePhotoName(photoId: string, photoName: string): Promise<ApiResponse<{ id: string; photo_name: string }>> {
    const response = await fetch(`${API_BASE_URL}/photos/${photoId}/name`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ photo_name: photoName }),
    });

    return this.handleResponse<{ id: string; photo_name: string }>(response);
  }

  async updateUser(id: string, userData: { 
    full_name: string; 
    email: string; 
    role: string;
    zone?: string;
    brands?: string[];
    specialty?: string;
    rating?: number;
    password?: string;
    cost_mtto_250h?: number;
    cost_mtto_500h?: number;
    cost_mtto_1000h?: number;
    cost_mtto_2000h?: number;
    cost_desplazamiento_km?: number;
    cost_hospedaje_dia?: number;
    cost_alimentacion_dia?: number;
    cost_hora_viaje_tecnico?: number;
    cost_valor_hora_mano_obra?: number;
    contact?: string;
    payment_method?: string;
  }): Promise<ApiResponse<User>> {
    const response = await fetch(`${API_BASE_URL}/auth/users/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });
    return this.handleResponse<User>(response);
  }

  async deleteUser(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/auth/users/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }

  async getActs(params?: {
    act_type?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: EquipmentAct[]; total: number; page: number; limit: number }>> {
    const query = new URLSearchParams();
    if (params?.act_type) query.set('act_type', params.act_type);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/acts${suffix}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAct(id: string): Promise<ApiResponse<EquipmentAct>> {
    const response = await fetch(`${API_BASE_URL}/acts/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<EquipmentAct>(response);
  }

  async createAct(formData: FormData): Promise<ApiResponse<EquipmentAct>> {
    const headers: HeadersInit = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${API_BASE_URL}/acts`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return this.handleResponse<EquipmentAct>(response);
  }

  async updateAct(id: string, formData: FormData): Promise<ApiResponse<EquipmentAct>> {
    const headers: HeadersInit = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${API_BASE_URL}/acts/${id}`, {
      method: 'PUT',
      headers,
      body: formData,
    });
    return this.handleResponse<EquipmentAct>(response);
  }

  async deleteAct(id: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/acts/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }

  async deleteActPhoto(photoId: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/acts/photos/${photoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }

  async deleteActVideo(videoId: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/acts/videos/${videoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }

  async deleteActAttachment(attachmentId: string): Promise<ApiResponse<boolean>> {
    const response = await fetch(`${API_BASE_URL}/acts/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<boolean>(response);
  }
}

export const apiService = new ApiService();

// Initialize token on service creation
apiService.initializeToken();