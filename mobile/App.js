import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { analyzeImage, searchProducts } from './services/api';
import ProductPicker from './components/ProductPicker';

const STORAGE_KEY = 'closet_items_v1';
const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Shoes', 'Accessory', 'Other'];
const SEASONS = ['All', 'Spring', 'Summer', 'Autumn', 'Winter'];
const COLORS = ['Black', 'White', 'Gray', 'Navy', 'Blue', 'Green', 'Brown', 'Beige'];
const OUTFIT_SLOTS = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory'];

export default function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('All');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [productCandidates, setProductCandidates] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setItems(JSON.parse(raw));
        }
      } catch (error) {
        Alert.alert('Load failed', 'Could not load saved items.');
      }
    };
    loadItems();
  }, []);

  useEffect(() => {
    const saveItems = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        Alert.alert('Save failed', 'Could not save items.');
      }
    };
    saveItems();
  }, [items]);

  const itemsByCategory = useMemo(() => {
    const grouped = {};
    for (const item of items) {
      grouped[item.category] = grouped[item.category] || [];
      grouped[item.category].push(item);
    }
    return grouped;
  }, [items]);

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission needed', 'Camera access is required for scanning.');
        return;
      }
    }
    setScannerOpen(true);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    setBarcode(data || '');
    setScannerOpen(false);
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current) return;

    try {
      setAnalyzing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      setImageUri(photo.uri);
      setCameraOpen(false);

      // Analyze the image
      const result = await analyzeImage(photo.base64);

      // Auto-fill form fields
      if (result.category && CATEGORIES.includes(result.category)) {
        setCategory(result.category);
      }
      if (result.color && COLORS.includes(result.color)) {
        setColor(result.color);
      }
      if (result.season && SEASONS.includes(result.season)) {
        setSeason(result.season);
      }
      if (result.description) {
        setName(result.description);
      }
      if (result.brand_guess) {
        setNotes(`Brand: ${result.brand_guess}`);
      }

      // Search for matching products
      setSearchingProducts(true);
      const searchQuery = `${result.brand_guess || ''} ${result.description || result.category}`.trim();
      const searchResult = await searchProducts(searchQuery, barcode || null);
      setProductCandidates(searchResult.products || []);
      setSearchingProducts(false);

      if (searchResult.products?.length > 0) {
        setProductPickerVisible(true);
      }
    } catch (error) {
      console.error('Capture/Analyze error:', error);
      Alert.alert('Analysis failed', 'Could not analyze the image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo access is required to pick images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);

      // Optionally analyze picked image
      if (result.assets[0].base64) {
        try {
          setAnalyzing(true);
          const analysis = await analyzeImage(result.assets[0].base64);
          if (analysis.category && CATEGORIES.includes(analysis.category)) {
            setCategory(analysis.category);
          }
          if (analysis.color && COLORS.includes(analysis.color)) {
            setColor(analysis.color);
          }
          if (analysis.season && SEASONS.includes(analysis.season)) {
            setSeason(analysis.season);
          }
          if (analysis.description) {
            setName(analysis.description);
          }
        } catch (error) {
          console.error('Analysis error:', error);
        } finally {
          setAnalyzing(false);
        }
      }
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductPickerVisible(false);
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setColor('');
    setSeason('All');
    setBarcode('');
    setNotes('');
    setImageUri('');
    setSelectedProduct(null);
    setProductCandidates([]);
  };

  const addItem = () => {
    if (!category) {
      Alert.alert('Missing info', 'Please select a category.');
      return;
    }

    const normalizedName = name.trim() || `${color || 'Item'} ${category}`.trim();
    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedName,
      category,
      color,
      season,
      barcode: barcode.trim(),
      notes: notes.trim(),
      imageUri,
      createdAt: new Date().toISOString(),
      // Product info if selected
      product: selectedProduct
        ? {
            name: selectedProduct.name,
            brand: selectedProduct.brand,
            price: selectedProduct.price,
            purchaseUrl: selectedProduct.url,
            janCode: selectedProduct.janCode || null,
            source: selectedProduct.source,
          }
        : null,
    };

    setItems((prev) => [newItem, ...prev]);
    resetForm();
  };

  const generateOutfit = () => {
    if (!items.length) {
      Alert.alert('No items yet', 'Add a few items before generating outfits.');
      return;
    }

    const picks = {};
    for (const slot of OUTFIT_SLOTS) {
      const options = itemsByCategory[slot] || [];
      if (options.length) {
        const choice = options[Math.floor(Math.random() * options.length)];
        picks[slot] = choice;
      }
    }

    if (!Object.keys(picks).length) {
      Alert.alert('Not enough categories', 'Add items with different categories.');
      return;
    }

    setOutfit({
      id: `outfit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: picks,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Closet MVP</Text>
        <Text style={styles.subtitle}>Register items and generate outfits.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Item</Text>

          {/* Primary capture button */}
          <Pressable
            style={[styles.captureButton, analyzing && styles.captureButtonDisabled]}
            onPress={openCamera}
            disabled={analyzing}
          >
            {analyzing ? (
              <View style={styles.captureButtonContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.captureButtonText}>Analyzing...</Text>
              </View>
            ) : (
              <Text style={styles.captureButtonText}>Capture & Analyze</Text>
            )}
          </Pressable>

          <View style={styles.row}>
            <Pressable style={[styles.actionButton, styles.actionButtonSpacer]} onPress={pickImage}>
              <Text style={styles.actionButtonText}>Pick Photo</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={openScanner}>
              <Text style={styles.actionButtonText}>Scan Barcode</Text>
            </Pressable>
          </View>

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : null}

          {selectedProduct && (
            <View style={styles.selectedProductCard}>
              <Text style={styles.selectedProductLabel}>Linked Product</Text>
              <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
              {selectedProduct.brand && (
                <Text style={styles.selectedProductMeta}>{selectedProduct.brand}</Text>
              )}
              {selectedProduct.price && (
                <Text style={styles.selectedProductPrice}>
                  {selectedProduct.price.toLocaleString()}
                </Text>
              )}
              <Pressable
                style={styles.changeProductButton}
                onPress={() => setProductPickerVisible(true)}
              >
                <Text style={styles.changeProductButtonText}>Change</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Name (optional)"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CATEGORIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setCategory(option)}
                style={[styles.chip, category === option && styles.chipActive]}
              >
                <Text style={category === option ? styles.chipTextActive : styles.chipText}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {COLORS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setColor(option)}
                style={[styles.chip, color === option && styles.chipActive]}
              >
                <Text style={color === option ? styles.chipTextActive : styles.chipText}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Season</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {SEASONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setSeason(option)}
                style={[styles.chip, season === option && styles.chipActive]}
              >
                <Text style={season === option ? styles.chipTextActive : styles.chipText}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Pressable style={styles.primaryButton} onPress={addItem}>
            <Text style={styles.primaryButtonText}>Add to Closet</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outfit Generator</Text>
          <Pressable style={styles.primaryButton} onPress={generateOutfit}>
            <Text style={styles.primaryButtonText}>Generate Outfit</Text>
          </Pressable>

          {outfit ? (
            <View style={styles.outfitCard}>
              <Text style={styles.outfitTitle}>Latest Outfit</Text>
              {OUTFIT_SLOTS.map((slot) => {
                const slotItem = outfit.items[slot];
                if (!slotItem) return null;
                return (
                  <View key={slot} style={styles.itemRow}>
                    {slotItem.imageUri ? (
                      <Image source={{ uri: slotItem.imageUri }} style={styles.itemThumb} />
                    ) : (
                      <View style={styles.itemThumbPlaceholder} />
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{slotItem.name}</Text>
                      <Text style={styles.itemMeta}>
                        {slotItem.category} · {slotItem.color || 'No color'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helperText}>No outfit generated yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Closet ({items.length})</Text>
          {items.length ? (
            items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.itemThumb} />
                ) : (
                  <View style={styles.itemThumbPlaceholder} />
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category} · {item.color || 'No color'} · {item.season}
                  </Text>
                  {item.product && (
                    <Text style={styles.itemMeta}>
                      {item.product.brand || 'Unknown'} · {item.product.price?.toLocaleString() || '-'}
                    </Text>
                  )}
                  {item.barcode ? (
                    <Text style={styles.itemMeta}>Barcode: {item.barcode}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.helperText}>No items yet. Add your first piece.</Text>
          )}
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerOpen} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.sectionTitle}>Scan Barcode</Text>
            <Pressable onPress={() => setScannerOpen(false)}>
              <Text style={styles.linkText}>Close</Text>
            </Pressable>
          </View>
          {permission?.granted ? (
            <CameraView
              style={styles.scanner}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93'],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            />
          ) : (
            <Text style={styles.helperText}>Camera permission denied.</Text>
          )}
        </SafeAreaView>
      </Modal>

      {/* Camera Capture Modal */}
      <Modal visible={cameraOpen} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.sectionTitle}>Capture Item</Text>
            <Pressable onPress={() => setCameraOpen(false)}>
              <Text style={styles.linkText}>Close</Text>
            </Pressable>
          </View>
          {permission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView ref={cameraRef} style={styles.scanner} facing="back" />
              <View style={styles.cameraControls}>
                <Pressable style={styles.captureCircle} onPress={captureAndAnalyze}>
                  <View style={styles.captureCircleInner} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.helperText}>Camera permission denied.</Text>
          )}
        </SafeAreaView>
      </Modal>

      {/* Product Picker Modal */}
      <ProductPicker
        visible={productPickerVisible}
        products={productCandidates}
        loading={searchingProducts}
        onSelect={handleProductSelect}
        onClose={() => setProductPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ee',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b6b6b',
  },
  section: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f1f1f',
  },
  row: {
    flexDirection: 'row',
    marginTop: 12,
  },
  captureButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  captureButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captureButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d2c9',
    backgroundColor: '#fbfaf8',
    alignItems: 'center',
  },
  actionButtonSpacer: {
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d2d2d',
  },
  preview: {
    marginTop: 12,
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  selectedProductCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  selectedProductLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectedProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  selectedProductMeta: {
    fontSize: 12,
    color: '#6b6b6b',
    marginTop: 2,
  },
  selectedProductPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
    marginTop: 4,
  },
  changeProductButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
  },
  changeProductButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  input: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1dbd1',
    backgroundColor: '#fff',
    fontSize: 14,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  label: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
    color: '#4d4d4d',
  },
  chipRow: {
    marginTop: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ded8cf',
    marginRight: 10,
    backgroundColor: '#faf8f4',
  },
  chipActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  chipText: {
    fontSize: 12,
    color: '#3f3f3f',
  },
  chipTextActive: {
    fontSize: 12,
    color: '#fff',
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#7a7a7a',
  },
  outfitCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8f6f2',
  },
  outfitTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2d2d2d',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#e6e0d8',
  },
  itemThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#e2ddd4',
  },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6c6c6c',
    marginTop: 2,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  scanner: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  linkText: {
    color: '#1f1f1f',
    fontWeight: '600',
  },
});
