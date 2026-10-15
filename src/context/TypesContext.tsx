import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MachineType, ComponentType } from '../types';
import { apiService } from '../services/api';

interface TypesContextType {
  machineTypes: MachineType[];
  componentTypes: ComponentType[];
  machineModels: MachineType[];
  loading: boolean;
  error: string | null;
  refreshMachineTypes: () => Promise<void>;
  refreshComponentTypes: () => Promise<void>;
  refreshMachineModels: () => Promise<void>;
  createMachineType: (data: { name: string; description: string }) => Promise<void>;
  createComponentType: (data: { name: string; description: string }) => Promise<void>;
  createMachineModel: (data: { name: string; description: string }) => Promise<void>;
  updateMachineType: (id: string, data: { name: string; description: string }) => Promise<void>;
  updateComponentType: (id: string, data: { name: string; description: string }) => Promise<void>;
  updateMachineModel: (id: string, data: { name: string; description: string }) => Promise<void>;
  deleteMachineType: (id: string) => Promise<void>;
  deleteComponentType: (id: string) => Promise<void>;
  deleteMachineModel: (id: string) => Promise<void>;
}

const TypesContext = createContext<TypesContextType | undefined>(undefined);

export const useTypes = () => {
  const context = useContext(TypesContext);
  if (context === undefined) {
    throw new Error('useTypes must be used within a TypesProvider');
  }
  return context;
};

interface TypesProviderProps {
  children: ReactNode;
}

export const TypesProvider: React.FC<TypesProviderProps> = ({ children }) => {
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [machineModels, setMachineModels] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMachineTypes = async () => {
    try {
      setError(null);
      const response = await apiService.getMachineTypes();
      console.log('📦 TypesContext - Machine Types API Response:', response);
      if (response.success && response.data) {
        console.log('✅ TypesContext - Setting machine types:', response.data.length);
        setMachineTypes(response.data);
      } else {
        console.warn('⚠️ TypesContext - No data in response or not successful');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching machine types');
      console.error('❌ Error fetching machine types:', err);
    }
  };

  const fetchComponentTypes = async () => {
    try {
      setError(null);
      const response = await apiService.getComponentTypes();
      if (response.success && response.data) {
        setComponentTypes(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching component types');
      console.error('Error fetching component types:', err);
    }
  };

  const refreshMachineTypes = async () => {
    await fetchMachineTypes();
  };

  const refreshComponentTypes = async () => {
    await fetchComponentTypes();
  };

  const fetchMachineModels = async () => {
    try {
      setError(null);
      const response = await apiService.getMachineModels();
      if (response.success && response.data) {
        setMachineModels(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching models');
      console.error('Error fetching models:', err);
    }
  };

  const refreshMachineModels = async () => {
    await fetchMachineModels();
  };

  const createMachineType = async (data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.createMachineType(data);
      if (response.success) {
        await fetchMachineTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating machine type');
      throw err;
    }
  };

  const createComponentType = async (data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.createComponentType(data);
      if (response.success) {
        await fetchComponentTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating component type');
      throw err;
    }
  };

  const updateMachineType = async (id: string, data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.updateMachineType(id, data);
      if (response.success) {
        await fetchMachineTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating machine type');
      throw err;
    }
  };

  const updateComponentType = async (id: string, data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.updateComponentType(id, data);
      if (response.success) {
        await fetchComponentTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating component type');
      throw err;
    }
  };

  const deleteMachineType = async (id: string) => {
    try {
      setError(null);
      const response = await apiService.deleteMachineType(id);
      if (response.success) {
        await fetchMachineTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting machine type');
      throw err;
    }
  };

  const deleteComponentType = async (id: string) => {
    try {
      setError(null);
      const response = await apiService.deleteComponentType(id);
      if (response.success) {
        await fetchComponentTypes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting component type');
      throw err;
    }
  };

  const createMachineModel = async (data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.createMachineModel(data);
      if (response.success) {
        await fetchMachineModels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating model');
      throw err;
    }
  };

  const updateMachineModel = async (id: string, data: { name: string; description: string }) => {
    try {
      setError(null);
      const response = await apiService.updateMachineModel(id, data);
      if (response.success) {
        await fetchMachineModels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating model');
      throw err;
    }
  };

  const deleteMachineModel = async (id: string) => {
    try {
      setError(null);
      const response = await apiService.deleteMachineModel(id);
      if (response.success) {
        await fetchMachineModels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting model');
      throw err;
    }
  };

  useEffect(() => {
    const initializeTypes = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchMachineTypes(), fetchComponentTypes(), fetchMachineModels()]);
      } catch (err) {
        console.error('Error initializing types:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeTypes();
  }, []);

  const value: TypesContextType = {
    machineTypes,
    componentTypes,
    machineModels,
    loading,
    error,
    refreshMachineTypes,
    refreshComponentTypes,
    refreshMachineModels,
    createMachineType,
    createComponentType,
    createMachineModel,
    updateMachineType,
    updateComponentType,
    updateMachineModel,
    deleteMachineType,
    deleteComponentType,
    deleteMachineModel,
  };

  return (
    <TypesContext.Provider value={value}>
      {children}
    </TypesContext.Provider>
  );
}; 