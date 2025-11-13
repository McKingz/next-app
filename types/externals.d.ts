declare module '@rneui/themed' {
  interface ButtonProps {
    title?: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
    [key: string]: any;
  }
  export const Button: React.ComponentType<ButtonProps>;
  
  interface InputProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    [key: string]: any;
  }
  export const Input: React.ComponentType<InputProps>;
}

declare module 'react-native-document-picker' {
  interface DocumentPickerResponse {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  }
  
  interface DocumentPickerOptions {
    type?: string[];
    allowMultiSelection?: boolean;
    copyTo?: string;
  }
  
  interface DocumentPicker {
    pick(options?: DocumentPickerOptions): Promise<DocumentPickerResponse[]>;
  }
  
  const DocumentPicker: DocumentPicker;
  export default DocumentPicker;
  export const isCancel: (error: any) => boolean;
  export const isInProgress: (error: any) => boolean;
  export const types: Record<string, string[]>;
}

declare module 'expo-sqlite/next' {
  interface SQLiteDatabase {
    execSync(sql: string, params?: any[]): void;
    getAllSync(sql: string, params?: any[]): any[];
    getFirstSync(sql: string, params?: any[]): any;
    runSync(sql: string, params?: any[]): { changes: number; lastInsertRowId: number };
  }
  
  export function openDatabaseSync(name: string): SQLiteDatabase;
  export type { SQLiteDatabase };
  const _default: {
    openDatabaseSync: typeof openDatabaseSync;
  };
  export default _default;
}
