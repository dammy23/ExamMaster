import api from './api';

// Description: Upload an image file for use in WYSIWYG editor
// Endpoint: POST /api/upload/image
// Request: FormData with 'image' field containing the image file
// Response: { success: boolean, imageUrl: string, message: string }
export const uploadImage = async (imageFile: File) => {
  try {
    console.log('Uploading image:', imageFile.name, 'Size:', imageFile.size);

    // Create FormData object
    const formData = new FormData();
    formData.append('image', imageFile);

    // Make the upload request
    const response = await api.post('/api/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('Image upload successful:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    throw new Error(error?.response?.data?.message || error.message || 'Failed to upload image');
  }
};