import { Item, FormValues } from '../types';

/**
 * 1. 将 headers 从 Record<string, string> 转换为 { key: string; value: string }[] 以适配 Form.List
 */
export function adjustFormValues(values: Item): FormValues {
  const adjustedValues = { ...values } as unknown as FormValues;

  if (values.headers) {
    adjustedValues.headers = Object.entries(values.headers).map(([key, value]) => ({ key, value }));
  }

  return adjustedValues;
}

export function adjustSubmitValues(values: FormValues): Item {
  const adjustedValues = { ...values } as unknown as Item;

  if (values.headers) {
    adjustedValues.headers = values.headers.reduce((acc, { key, value }) => {
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
  } else {
    adjustedValues.headers = {};
  }

  return adjustedValues;
}
