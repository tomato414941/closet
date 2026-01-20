import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import App from '../App';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: [] })
  ),
  MediaTypeOptions: { Images: 'Images' },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];
const SEASONS = ['All', 'Spring', 'Summer', 'Autumn', 'Winter'];
const COLORS = ['Black', 'White', 'Gray', 'Navy', 'Blue', 'Green', 'Brown', 'Beige'];

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<App />);

    expect(screen.getByText('Closet MVP')).toBeTruthy();
    expect(screen.getByText('Register items and generate outfits.')).toBeTruthy();
    expect(screen.getByText('Add Item')).toBeTruthy();
    expect(screen.getByText('Outfit Generator')).toBeTruthy();
  });

  it('displays all categories', () => {
    render(<App />);

    CATEGORIES.forEach((category) => {
      expect(screen.getByText(category)).toBeTruthy();
    });
  });

  it('displays all colors', () => {
    render(<App />);

    COLORS.forEach((color) => {
      expect(screen.getByText(color)).toBeTruthy();
    });
  });

  it('displays all seasons', () => {
    render(<App />);

    SEASONS.forEach((season) => {
      expect(screen.getByText(season)).toBeTruthy();
    });
  });

  it('shows alert when adding item without category', () => {
    render(<App />);

    const addButton = screen.getByText('Add to Closet');
    fireEvent.press(addButton);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing info',
      'Please select a category.'
    );
  });

  it('adds item when category is selected', async () => {
    render(<App />);

    // Select category
    const topCategory = screen.getByText('Top');
    fireEvent.press(topCategory);

    // Select color
    const blackColor = screen.getByText('Black');
    fireEvent.press(blackColor);

    // Add item
    const addButton = screen.getByText('Add to Closet');
    fireEvent.press(addButton);

    // Should not show error alert
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Missing info',
      expect.anything()
    );

    // Item should appear in closet list
    await waitFor(() => {
      expect(screen.getByText('Black Top')).toBeTruthy();
    });
  });

  it('shows alert when generating outfit with no items', () => {
    render(<App />);

    const generateButton = screen.getByText('Generate Outfit');
    fireEvent.press(generateButton);

    expect(Alert.alert).toHaveBeenCalledWith(
      'No items yet',
      'Add a few items before generating outfits.'
    );
  });

  it('generates outfit when items exist', async () => {
    render(<App />);

    // Add an item first
    const topCategory = screen.getByText('Top');
    fireEvent.press(topCategory);

    const addButton = screen.getByText('Add to Closet');
    fireEvent.press(addButton);

    // Wait for item to be added
    await waitFor(() => {
      expect(screen.getByText(/Closet \(1\)/)).toBeTruthy();
    });

    // Generate outfit
    const generateButton = screen.getByText('Generate Outfit');
    fireEvent.press(generateButton);

    // Should show outfit
    await waitFor(() => {
      expect(screen.getByText('Latest Outfit')).toBeTruthy();
    });
  });

  it('loads items from AsyncStorage on mount', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const savedItems = [
      {
        id: 'test-1',
        name: 'Blue Shirt',
        category: 'Top',
        color: 'Blue',
        season: 'All',
        barcode: '',
        notes: '',
        imageUri: '',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedItems));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Blue Shirt')).toBeTruthy();
    });
  });

  it('shows Scan Barcode button', () => {
    render(<App />);

    expect(screen.getByText('Scan Barcode')).toBeTruthy();
  });

  it('shows Pick Photo button', () => {
    render(<App />);

    expect(screen.getByText('Pick Photo')).toBeTruthy();
  });

  it('shows empty state message when no items', () => {
    render(<App />);

    expect(screen.getByText('No items yet. Add your first piece.')).toBeTruthy();
  });

  it('shows empty outfit state initially', () => {
    render(<App />);

    expect(screen.getByText('No outfit generated yet.')).toBeTruthy();
  });
});
