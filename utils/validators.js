export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const urlPattern = /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/[^\s]*)?$/i;

export const maxArrayLength = (max) => ({
  validator: (arr) => Array.isArray(arr) && arr.length <= max,
  message: `Array length cannot exceed ${max}`,
});

export const nonNegativeNumber = { validator: (v) => typeof v === 'number' && v >= 0, message: 'Value cannot be negative' };

export default { emailPattern, urlPattern, maxArrayLength, nonNegativeNumber };
