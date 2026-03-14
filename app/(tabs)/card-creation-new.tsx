import { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  StyleSheet, 
  TextInput,
  Switch,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Wand2, ChevronDown, ChevronUp, Lock, Users, Globe2, Check, Plus, Edit, PlusCircle, Upload } from 'lucide-react-native';
import { log, logError } from '@/utils/logger';

SplashScreen.preventAutoHideAsync();

// Supabase client is already imported from @/lib/supabase

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_FRAME_COLOR = '#808080'; // Medium gray

// Background gradient options
const GRADIENT_OPTIONS = [
  { name: 'Shadow Storm', colors: ['#6b7280', '#000000'] },
  { name: 'Deep Violet', colors: ['#8b5cf6', '#1e1b4b'] },
  { name: 'Abyss Blue', colors: ['#3b82f6', '#0c1e33'] },
  { name: 'Molten Fire', colors: ['#dc2626', '#7f1d1d'] },
  { name: 'Dark Forest', colors: ['#16a34a', '#14532d'] }
];

export default function CardCreationNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Debug: Log all params on component mount
  log('=== CardCreationNewScreen mounted ===');
  log('All params:', JSON.stringify(params, null, 2));
  log('draftId param:', params.draftId);
  log('edit_mode param:', params.edit_mode);
  log('returnTo param:', params.returnTo);
  
  // Treat the screen as "editing" only when explicitly opened in edit mode
  // (e.g., from the Cards tab with edit_mode='true' and an existing card id).
  const isEditing = params.edit_mode === 'true' && !!params.id;

  // Initialize state with params or defaults
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [type, setType] = useState('Intention');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('TBD');
  const [cardImage, setCardImage] = useState('');
  const [format, setFormat] = useState<'framed' | 'fullBleed'>('fullBleed'); // Default to fullBleed since default generation type is premium
  const [backgroundGradient, setBackgroundGradient] = useState<string[]>(['#1a1a1a', '#000000']); // Default black gradient
  
  // Get return parameters for navigation
  const returnTo = params.returnTo as string | undefined;
  const returnZone = params.zone as string | undefined;
  const shadowForCardId = params.shadowForCardId as string | undefined;
  const inboxJobId = params.generation_job_id as string | undefined;
  const draftId = params.draftId as string | undefined;
  
  // Track if draft is still loading - use ref for immediate access
  const [isDraftLoading, setIsDraftLoading] = useState(!!draftId);
  const isDraftLoadedRef = useRef(false);
  // Store the original draft data for comparison when saving
  const loadedDraftDataRef = useRef<any>(null);

  // Load draft data if draftId is provided - use useFocusEffect to reload on every screen focus
  useFocusEffect(
    useCallback(() => {
      const loadDraft = async () => {
        if (!draftId) {
          isDraftLoadedRef.current = true;
          return;
        }
        
        setIsDraftLoading(true);
        isDraftLoadedRef.current = false;
        loadedDraftDataRef.current = null;
        log('Loading draft with ID:', draftId);
        
        try {
          const { data, error } = await supabase
            .from('card_drafts')
            .select('*')
            .eq('id', draftId)
            .single();
          
          if (error) {
            logError('Error loading draft:', error);
            setIsDraftLoading(false);
            isDraftLoadedRef.current = true;
            return;
          }
          
          if (data) {
            log('Draft loaded successfully:', data.name);
            // Store the loaded data in ref for later use
            loadedDraftDataRef.current = data;
            
            setName(data.name || '');
            setDescription(data.description || '');
            setImageDescription(data.image_description || '');
            setType(data.type || 'Intention');
            setRole(data.role || '');
            setContext(data.context || 'TBD');
            setCardImage(data.image_url || '');
            setFormat(data.format || 'fullBleed');
            setBorderStyle(data.border_style || 'Classic');
            setBorderColor(data.border_color || '#808080');
            setIsUploadedImage(data.is_uploaded_image || false);
            
            // Parse background gradient if it exists
            if (data.background_gradient) {
              try {
                const gradient = JSON.parse(data.background_gradient);
                if (Array.isArray(gradient)) {
                  setBackgroundGradient(gradient);
                }
              } catch (e) {
                log('Could not parse background gradient');
              }
            }
            
            // Parse visibility if it exists
            if (data.visibility && Array.isArray(data.visibility)) {
              setVisibility(data.visibility);
            }
            
            // Restore generation type if it exists
            if (data.generation_type) {
              if (data.generation_type === 'custom' && data.custom_generation_type_id) {
                setSelectedGenerationType(`custom_${data.custom_generation_type_id}`);
                setSelectedCustomGenerationType(data.custom_generation_type_id);
              } else {
                setSelectedGenerationType(data.generation_type);
              }
              log('Restored generation type from draft:', data.generation_type);
            }
            
            isDraftLoadedRef.current = true;
            log('Draft data applied to form, isDraftLoadedRef:', isDraftLoadedRef.current);
          }
        } catch (err) {
          logError('Error in loadDraft:', err);
          isDraftLoadedRef.current = true;
        } finally {
          setIsDraftLoading(false);
        }
      };
      
      loadDraft();
    }, [draftId])
  );
  
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingImageDescription, setIsGeneratingImageDescription] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [isPremiumGeneration, setIsPremiumGeneration] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [customGenerationTypes, setCustomGenerationTypes] = useState<any[]>([]);
  const [selectedCustomGenerationType, setSelectedCustomGenerationType] = useState<string | null>(null);
  const [isUploadedImage, setIsUploadedImage] = useState(false); // Track if image was uploaded vs generated

  // Draft modal state
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [assistedMode, setAssistedMode] = useState(!isEditing);
  const [assistedStep, setAssistedStep] = useState(0);

  const assistedStepMeta = [
    {
      key: 'name',
      title: 'Card title',
      subtitle: 'Give your card a clear, memorable name that captures its essence.',
    },
    {
      key: 'description',
      title: 'Card description',
      subtitle: 'Describe what this card reveals or how it should be used in a spread.',
    },
    {
      key: 'type',
      title: 'Phenomena type',
      subtitle: 'Choose the main dimension this card speaks to (Intention, Context, Impact, etc.).',
    },
    {
      key: 'detail',
      title: 'Detail',
      subtitle: 'Add a specific angle or nuance within that type (for example, a particular Role or Impact).',
    },
    {
      key: 'context',
      title: 'Context',
      subtitle: 'Optional: capture the situation, relationship, or power dynamics this card focuses on.',
    },
    {
      key: 'imageDescription',
      title: 'Image description',
      subtitle: 'Describe the visual you want on the card so the image generator knows what to create.',
    },
    {
      key: 'generate',
      title: 'Generate your card image',
      subtitle: 'Use your image description and generation type to create the card art.',
    },
  ];

  // Check for completed jobs on screen focus
  useFocusEffect(
    useCallback(() => {
      const checkJobStatus = async () => {
        if (generationJobId) {
          log('Checking status for job:', generationJobId);
          const { data, error } = await supabase
            .from('image_generation_queue')
            .select('status, image_url')
            .eq('id', generationJobId)
            .single();

          if (error) {
            logError('Error fetching job status:', error);
            return;
          }

          if (data.status === 'completed' && data.image_url) {
            log('Job completed! Image URL:', data.image_url);
            setCardImage(data.image_url);
            setGenerationJobId(null); // Clear the job ID
            Alert.alert('Image Ready!', 'Your new card image has been successfully generated.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (data.status === 'failed') {
            setError('Image generation failed. Please try again.');
            setGenerationJobId(null);
          } else {
            log('Job status:', data.status);
          }
        }
      };

      const intervalId = setInterval(checkJobStatus, 5000); // Check every 5 seconds

      return () => clearInterval(intervalId);
    }, [generationJobId])
  );

  // Track unsaved changes
  const [borderStyle, setBorderStyle] = useState('Classic');
  const [borderColor, setBorderColor] = useState('#808080'); // Default medium gray
  const [visibility, setVisibility] = useState<string[]>(['personal']);

  useEffect(() => {
    const hasChanges = 
      name.trim() !== '' || 
      description.trim() !== '' || 
      imageDescription.trim() !== '' || 
      type !== 'Intention' || 
      role.trim() !== '' || 
      context !== 'TBD' || 
      cardImage.trim() !== '' || 
      format !== 'fullBleed' || 
      backgroundGradient.join(',') !== ['#1a1a1a', '#000000'].join(',') ||
      borderStyle !== 'Classic' || 
      borderColor !== '#808080' ||
      visibility.length > 1 || // More than just 'personal'
      isUploadedImage;
    
    setHasUnsavedChanges(hasChanges);
  }, [name, description, imageDescription, type, role, context, cardImage, format, backgroundGradient, borderStyle, borderColor, visibility, isUploadedImage]);

  // Collapsible section states
  const [showVisibility, setShowVisibility] = useState(false);


  
  // Dropdown states
  const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);
  const [showGenerationTypeDropdown, setShowGenerationTypeDropdown] = useState(false);
  
  // Inline creation states
  const [newTypeInput, setNewTypeInput] = useState('');
  const [newDetailInput, setNewDetailInput] = useState('');
  const [newContextInput, setNewContextInput] = useState('');
  const [newBorderStyleInput, setNewBorderStyleInput] = useState('');
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [showNewDetailInput, setShowNewDetailInput] = useState(false);
  const [showNewContextInput, setShowNewContextInput] = useState(false);
  const [showNewBorderStyleInput, setShowNewBorderStyleInput] = useState(false);
  
  // Custom contexts state (make contexts dynamic like types)
  const [customContexts, setCustomContexts] = useState<string[]>([]);
  
  // Collapsible section states
  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [showDetailOptions, setShowDetailOptions] = useState(false);
  const [showContextOptions, setShowContextOptions] = useState(false);
  const [showBorderStyleOptions, setShowBorderStyleOptions] = useState(false);
  const [showBorderColorOptions, setShowBorderColorOptions] = useState(false);
  
  // Auto-complete states for type input
  const [typeInputValue, setTypeInputValue] = useState('');
  const [filteredTypeOptions, setFilteredTypeOptions] = useState<string[]>([]);
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);
  
  // Auto-complete states for detail (role) input
  const [detailInputValue, setDetailInputValue] = useState('');
  const [filteredDetailOptions, setFilteredDetailOptions] = useState<string[]>([]);
  const [showDetailSuggestions, setShowDetailSuggestions] = useState(false);
  
  // Auto-complete states for context input
  const [contextInputValue, setContextInputValue] = useState('');
  const [filteredContextOptions, setFilteredContextOptions] = useState<string[]>([]);
  const [showContextSuggestions, setShowContextSuggestions] = useState(false);
  
  // Border color options
  const borderColorOptions = [
    { name: 'Silver', color: '#C0C0C0' },
    { name: 'Gold', color: '#FFD700' },
    { name: 'Bronze', color: '#CD7F32' },
    { name: 'Platinum', color: '#E5E4E2' },
    { name: 'Copper', color: '#B87333' },
    { name: 'Steel', color: '#808080' },
    { name: 'Obsidian', color: '#3C3C3C' },
    { name: 'Pearl', color: '#F0EAD6' },
    { name: 'Emerald', color: '#50C878' },
    { name: 'Ruby', color: '#E0115F' },
    { name: 'Sapphire', color: '#0F52BA' },
    { name: 'Amethyst', color: '#9966CC' }
  ];
  
  // Generation type selection - now includes custom types
  const [selectedGenerationType, setSelectedGenerationType] = useState<'legacy' | 'premium' | 'classic' | 'modern_parchment' | string>('premium');
  
  // Generation type options
  // Dynamic generation type options that include custom types
  const generationTypeOptions = [
    { key: 'legacy', label: 'Legacy: Background Image', description: 'Traditional background generation' },
    { key: 'premium', label: 'Premium: Classic Card Generation', description: 'Enhanced prompt processing with premium styling' },
    { key: 'classic', label: 'Full Bleed Card, No Description Text', description: 'Complete trading card with integrated text elements' },
    { key: 'modern_parchment', label: 'Premium: Classic TCG - Modern Parchment', description: 'Premium parchment frame with title bar, diamond badge, and detail ribbon' },
    ...customGenerationTypes.map(type => ({
      key: `custom_${type.id}`,
      label: `Custom: ${type.name}`,
      description: type.description || 'User-defined custom generation type',
      customTypeId: type.id
    }))
  ];
  
  // Chat functionality states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, imageUrl?: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  
  // Image cropping modal states
  const [showImageCropModal, setShowImageCropModal] = useState(false);
  const [tempImageUri, setTempImageUri] = useState('');
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape' | 'square'>('square');
  const [cropPresets, setCropPresets] = useState<Array<{ name: string, ratio: [number, number] | null, description: string }>>([
    { name: 'Card Portrait', ratio: [3, 4] as [number, number], description: 'Perfect for card backgrounds' },
    { name: 'Square', ratio: [1, 1] as [number, number], description: 'Classic square format' },
    { name: 'Original', ratio: null, description: 'Keep original proportions' }
  ]);
  
  // Dropdown options - loaded from AsyncStorage to include custom phenomena types
  const [typeOptions, setTypeOptions] = useState(['Intention', 'Context', 'Impact', 'Accuracy', 'Agenda', 'Needs', 'Emotion', 'Role']);
  
  // Custom detail options state
  const [customDetailOptions, setCustomDetailOptions] = useState<Record<string, string[]>>({});
  
  // Default detail options map
  const defaultSubOptionsMap: Record<string, string[]> = {
    Intention: ['Impact', 'Request', 'Protect', 'Connect'],
    Role: ['Advisor', 'Confessor', 'Judge', 'Peacemaker', 'Provocateur', 'Entertainer', 'Gatekeeper'],
    Context: ['Setting', 'Timing', 'Relationship', 'Power'],
    Impact: ['Very Positive', 'Slightly Positive', 'Neutral', 'Slightly Negative', 'Very Negative'],
    Accuracy: ['Veridical', 'Mostly True', 'Distorted', 'Completely Off-Base', 'Manipulative'],
    Needs: ['Connection', 'Autonomy', 'Safety', 'Meaning', 'Play', 'Rest'],
    Emotion: ['Joy', 'Anger', 'Fear', 'Sadness', 'Surprise', 'Disgust', 'Love'],
  };

  // Merged options map that combines default and custom options
  const subOptionsMap = useMemo(() => {
    const merged: Record<string, string[]> = {};
    
    // Start with default options
    Object.keys(defaultSubOptionsMap).forEach(phenomenaType => {
      merged[phenomenaType] = [...defaultSubOptionsMap[phenomenaType]];
    });
    
    // Add custom options for each phenomena type
    Object.keys(customDetailOptions).forEach(phenomenaType => {
      if (!merged[phenomenaType]) {
        merged[phenomenaType] = [];
      }
      // Add custom options to the end
      merged[phenomenaType] = [...merged[phenomenaType], ...customDetailOptions[phenomenaType]];
    });
    
    return merged;
  }, [customDetailOptions]);

  const roleOptions = useMemo(() => subOptionsMap[type] || [], [type]);

  // Default contexts - will be merged with custom ones
  const defaultContexts = ['TBD', 'Self', 'Family', 'Friendship', 'Therapy', 'Peer', 'Work', 'Art', 'Politics'];
  
  // Combined context options (defaults + custom)
  const contextOptions = useMemo(() => {
    const allContexts = [...defaultContexts];
    customContexts.forEach(customContext => {
      if (!allContexts.includes(customContext)) {
        allContexts.push(customContext);
      }
    });
    return allContexts;
  }, [customContexts]);

  // Unified label pool: merge all type, detail, and context options (deduplicated)
  const allLabelOptions = useMemo(() => {
    const combined = new Set<string>();
    typeOptions.forEach(opt => combined.add(opt));
    Object.values(subOptionsMap).forEach(arr => arr.forEach(opt => combined.add(opt)));
    contextOptions.forEach(opt => combined.add(opt));
    return Array.from(combined);
  }, [typeOptions, subOptionsMap, contextOptions]);
  
  // Auto-complete logic for type input
  const handleTypeInputChange = useCallback((input: string) => {
    setTypeInputValue(input);
    
    if (input.trim() === '') {
      setFilteredTypeOptions([]);
      setShowTypeSuggestions(false);
      return;
    }
    
    // Filter from unified label pool (case-insensitive)
    const filtered = allLabelOptions.filter(option => 
      option.toLowerCase().includes(input.toLowerCase())
    );
    
    setFilteredTypeOptions(filtered);
    setShowTypeSuggestions(filtered.length > 0);
  }, [allLabelOptions]);
  
  // Handle type selection from suggestions
  const handleTypeSelection = useCallback((selectedType: string) => {
    setType(selectedType);
    setTypeInputValue(selectedType);
    setRole(''); // Reset detail when type changes
    setShowTypeSuggestions(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);
  
  // Handle type input submission (Enter key)
  const handleTypeSubmit = useCallback(() => {
    const inputValue = typeInputValue.trim();
    if (inputValue && allLabelOptions.includes(inputValue)) {
      // Select existing label
      handleTypeSelection(inputValue);
    } else if (inputValue && !allLabelOptions.includes(inputValue)) {
      // Create new type if it doesn't exist in any pool
      addNewType(inputValue);
    }
  }, [typeInputValue, allLabelOptions, handleTypeSelection]);
  
  // Auto-complete logic for detail input
  const handleDetailInputChange = useCallback((input: string) => {
    setDetailInputValue(input);
    
    if (input.trim() === '') {
      setFilteredDetailOptions([]);
      setShowDetailSuggestions(false);
      return;
    }
    
    // Filter from unified label pool (case-insensitive)
    const filtered = allLabelOptions.filter(option => 
      option.toLowerCase().includes(input.toLowerCase())
    );
    
    setFilteredDetailOptions(filtered);
    setShowDetailSuggestions(filtered.length > 0);
  }, [allLabelOptions]);
  
  // Handle detail selection from suggestions
  const handleDetailSelection = useCallback((selectedDetail: string) => {
    setRole(selectedDetail);
    setDetailInputValue(selectedDetail);
    setShowDetailSuggestions(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);
  
  // Handle detail input submission (Enter key)
  const handleDetailSubmit = useCallback(() => {
    const inputValue = detailInputValue.trim();
    if (inputValue && allLabelOptions.includes(inputValue)) {
      // Select existing label
      handleDetailSelection(inputValue);
    } else if (inputValue && !allLabelOptions.includes(inputValue)) {
      // Create new detail if it doesn't exist in any pool
      addNewDetail(inputValue);
    }
  }, [detailInputValue, allLabelOptions, handleDetailSelection]);

  // Auto-complete logic for context input
  const handleContextInputChange = useCallback((input: string) => {
    setContextInputValue(input);
    
    if (input.trim() === '') {
      setFilteredContextOptions([]);
      setShowContextSuggestions(false);
      return;
    }
    
    // Filter from unified label pool (case-insensitive)
    const filtered = allLabelOptions.filter(option => 
      option.toLowerCase().includes(input.toLowerCase())
    );
    
    setFilteredContextOptions(filtered);
    setShowContextSuggestions(filtered.length > 0);
  }, [allLabelOptions]);
  
  // Handle context selection from suggestions
  const handleContextSelection = useCallback((selectedContext: string) => {
    setContext(selectedContext);
    setContextInputValue(selectedContext);
    setShowContextSuggestions(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);
  
  // Handle context input submission (Enter key)
  const handleContextSubmit = useCallback(() => {
    const inputValue = contextInputValue.trim();
    if (inputValue && allLabelOptions.includes(inputValue)) {
      // Select existing label
      handleContextSelection(inputValue);
    } else if (inputValue && !allLabelOptions.includes(inputValue)) {
      // Create new context if it doesn't exist in any pool
      addNewContext(inputValue);
    }
  }, [contextInputValue, allLabelOptions, handleContextSelection]);

  // Default border styles - will be merged with custom ones
  const defaultBorderStyles = ['Classic', 'Modern', 'Vintage', 'Minimal', 'Ornate', 'Rounded', 'Sharp', 'Double'];
  
  // Custom border styles state
  const [customBorderStyles, setCustomBorderStyles] = useState<string[]>([]);
  
  // Combined border style options (defaults + custom)
  const borderStyleOptions = useMemo(() => {
    const allBorderStyles = [...defaultBorderStyles];
    customBorderStyles.forEach(customBorderStyle => {
      if (!allBorderStyles.includes(customBorderStyle)) {
        allBorderStyles.push(customBorderStyle);
      }
    });
    return allBorderStyles;
  }, [customBorderStyles]);


  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Bold': Inter_700Bold,
  });

  // Get auth context at component level
  const { refreshSession, user } = useAuth();

  // Sync all input values to actual state - called before save/generate to ensure values are committed
  const syncInputValues = () => {
    const trimmedType = typeInputValue.trim();
    const trimmedDetail = detailInputValue.trim();
    const trimmedContext = contextInputValue.trim();
    
    if (trimmedType && trimmedType !== type) {
      setType(trimmedType);
    }
    if (trimmedDetail && trimmedDetail !== role) {
      setRole(trimmedDetail);
    }
    if (trimmedContext && trimmedContext !== context) {
      setContext(trimmedContext);
    }
    
    // Return the synced values for immediate use (since setState is async)
    return {
      type: trimmedType || type,
      role: trimmedDetail || role,
      context: trimmedContext || context
    };
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageDescription('');
    setType('Intention');
    setTypeInputValue(''); // Reset type input
    setRole('');
    setDetailInputValue(''); // Reset detail input
    setContext('TBD');
    setContextInputValue(''); // Reset context input
    setBorderStyle('Classic');
    setBorderColor('#808080');
    setCardImage('');
    setFormat('fullBleed'); // Default to fullBleed since default generation type is premium
    setVisibility(['personal']);

    
    // Reset loading/error/success states
    setIsGenerating(false);
    setIsGeneratingDescription(false);
    setIsGeneratingImageDescription(false);
    setIsCreating(false);
    setError('');
    setErrorDetails('');
    setSuccessMessage('');

    // Reset UI states
    setShowVisibility(false);
    setShowBackgroundDropdown(false);
    setShowGenerationTypeDropdown(false);
    setShowTypeSuggestions(false); // Reset suggestions
    setShowDetailSuggestions(false); // Reset detail suggestions
    setShowContextSuggestions(false); // Reset context suggestions
    
    // Reset inline creation states
    setNewTypeInput('');
    setNewDetailInput('');
    setNewContextInput('');
    setShowNewTypeInput(false);
    setShowNewDetailInput(false);
    setShowNewContextInput(false);
    
    // Reset collapsible states
    setShowTypeOptions(false);
    setShowDetailOptions(false);
    setShowContextOptions(false);
  };

  // Load phenomena types from database, fallback to AsyncStorage
  const loadPhenomenaTypes = async () => {
    try {
      if (!user) {
        log('No user found, using default phenomena types');
        return;
      }

      // First try to load from database
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('custom_phenomena_types')
        .eq('id', user.id)
        .single();

      if (dbError) {
        logError('Error loading phenomena types from database:', dbError);
        // Fall back to AsyncStorage
        await loadFromAsyncStorage();
        return;
      }

      if (userData?.custom_phenomena_types) {
        log('Loaded custom phenomena types from database:', userData.custom_phenomena_types);
        setTypeOptions(userData.custom_phenomena_types);
      } else {
        // If no database data, try AsyncStorage
        await loadFromAsyncStorage();
      }
    } catch (error) {
      logError('Error loading phenomena types:', error);
      // Fall back to AsyncStorage
      await loadFromAsyncStorage();
    }
  };

  const loadFromAsyncStorage = async () => {
    try {
      const storedPhenomena = await AsyncStorage.getItem('@phenomena_types');
      if (storedPhenomena) {
        const parsedPhenomena = JSON.parse(storedPhenomena);
        log('Loaded custom phenomena types from AsyncStorage:', parsedPhenomena);
        setTypeOptions(parsedPhenomena);
      } else {
        log('No custom phenomena types found, using defaults');
      }
    } catch (error) {
      logError('Error loading from AsyncStorage:', error);
      // Keep default types if loading fails
    }
  };

  // Load custom detail options from database
  const loadCustomDetailOptions = async () => {
    try {
      if (!user) {
        log('No user found, using default detail options');
        return;
      }

      // Load custom detail options from database
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('custom_detail_options')
        .eq('id', user.id)
        .single();

      if (dbError) {
        logError('Error loading custom detail options from database:', dbError);
        return;
      }

      if (userData?.custom_detail_options) {
        log('Loaded custom detail options from database:', userData.custom_detail_options);
        setCustomDetailOptions(userData.custom_detail_options);
      } else {
        log('No custom detail options found, using defaults only');
        setCustomDetailOptions({});
      }
    } catch (error) {
      logError('Error loading custom detail options:', error);
      // Keep empty custom options if loading fails
      setCustomDetailOptions({});
    }
  };

  // Load custom contexts from database
  const loadCustomContexts = async () => {
    try {
      if (!user) {
        log('No user found, using default contexts');
        return;
      }

      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('custom_contexts')
        .eq('id', user.id)
        .single();

      if (dbError) {
        logError('Error loading custom contexts from database:', dbError);
        return;
      }

      if (userData?.custom_contexts) {
        log('Loaded custom contexts from database:', userData.custom_contexts);
        setCustomContexts(userData.custom_contexts);
      } else {
        log('No custom contexts found, using defaults only');
        setCustomContexts([]);
      }
    } catch (error) {
      logError('Error loading custom contexts:', error);
      setCustomContexts([]);
    }
  };

  // Load custom border styles from database
  const loadCustomBorderStyles = async () => {
    try {
      if (!user) {
        log('No user found, using default border styles');
        return;
      }

      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('custom_border_styles')
        .eq('id', user.id)
        .single();

      if (dbError) {
        log('Database error for border styles, using defaults:', dbError);
        return;
      }

      if (userData?.custom_border_styles) {
        const customStyles = JSON.parse(userData.custom_border_styles);
        setCustomBorderStyles(customStyles);
        log('Loaded custom border styles from database:', customStyles.length);
      }
    } catch (err) {
      logError('Error loading custom border styles:', err);
    }
  };

  const loadCustomGenerationTypes = async () => {
    try {
      if (!user) {
        log('No user found, no custom generation types');
        return;
      }

      const { data, error } = await supabase
        .from('custom_generation_types')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        log('Error loading custom generation types:', error);
        return;
      }

      setCustomGenerationTypes(data || []);
      log('Loaded custom generation types:', data?.length || 0);
    } catch (err) {
      logError('Error loading custom generation types:', err);
    }
  };

  // Reset form state when the screen is focused for creating a new card
  useFocusEffect(
    useCallback(() => {
      // We only reset if we are not in edit mode AND not coming from inbox.
      // This ensures that when a user navigates away and back,
      // they get a fresh form instead of the old state.
      // But if they're coming from the inbox, we keep the pre-filled data.
      if (!isEditing && !inboxJobId) {
        resetForm();
        
        // After resetting, check if we have a preselected type to restore
        if (params.preselected_type) {
          setType(params.preselected_type.toString());
        }
      }
    }, [isEditing, inboxJobId, params.preselected_type])
  );

  // Use useEffect to properly set the state values from params
  useEffect(() => {
    if (params.id) {
      log('Loading edit data for card:', params.id);
      log('📋 All params received:', JSON.stringify(params, null, 2));
      setName(params.name?.toString() || '');
      setDescription(params.description?.toString() || '');
      setImageDescription(params.image_description?.toString() || ''); // Load image description for editing
      const loadedType = params.type?.toString() || '';
      setType(loadedType);
      setTypeInputValue(loadedType); // Set input value to match loaded type
      const loadedRole = params.role?.toString() || '';
      setRole(loadedRole);
      setDetailInputValue(loadedRole); // Set detail input value to match loaded role
      const loadedContext = params.context?.toString() || '';
      setContext(loadedContext);
      setContextInputValue(loadedContext); // Set context input value to match loaded context
      setBorderStyle(params.border_style?.toString() || 'Classic');
      setBorderColor(params.border_color?.toString() || '#808080');
      setCardImage(params.image_url?.toString() || '');
      
      // Restore generation type from params
      const loadedGenerationType = params.generation_type?.toString() || '';
      const loadedCustomGenTypeId = params.custom_generation_type_id?.toString() || '';
      if (loadedGenerationType) {
        if (loadedGenerationType === 'custom' && loadedCustomGenTypeId) {
          setSelectedGenerationType(`custom_${loadedCustomGenTypeId}`);
          setSelectedCustomGenerationType(loadedCustomGenTypeId);
        } else {
          setSelectedGenerationType(loadedGenerationType);
        }
        log('📋 Restored generation type from params:', loadedGenerationType);
      }
      log('📋 Card data loaded successfully for editing');
      
      // Load visibility settings
      const loadVisibilitySettings = async () => {
        try {
          // Fetch the card from the database to get the actual visibility settings and background gradient
          const { data: cardData, error } = await supabase
            .from('cards')
            .select('is_public, is_shared_with_friends, background_gradient, is_uploaded_image, border_style, border_color, generation_type, custom_generation_type_id')
            .eq('id', params.id)
            .single();
          
          if (error) {
            logError('Error fetching card visibility settings:', error);
            return;
          }
          
          if (cardData) {
            // Set visibility based on the actual database values
            const visibilitySettings = ['personal']; // Always include personal
            
            if (cardData.is_shared_with_friends) {
              visibilitySettings.push('friends');
            }
            
            if (cardData.is_public) {
              visibilitySettings.push('public');
            }
            
            log('Setting visibility to:', visibilitySettings);
            setVisibility(visibilitySettings);
            
            // Load background gradient if it exists
            if (cardData.background_gradient) {
              try {
                const gradient = JSON.parse(cardData.background_gradient);
                setBackgroundGradient(gradient);
                log('Loaded background gradient:', gradient);
              } catch (err) {
                logError('Error parsing background gradient:', err);
                // Keep default gradient if parsing fails
              }
            }
            
            // Load uploaded image flag
            setIsUploadedImage(cardData.is_uploaded_image || false);
            log('Loaded uploaded image flag:', cardData.is_uploaded_image);
            
            // Load border style if it exists
            if (cardData.border_style) {
              setBorderStyle(cardData.border_style);
              log('Loaded border style:', cardData.border_style);
            }
            
            // Load border color if it exists
            if (cardData.border_color) {
              setBorderColor(cardData.border_color);
              log('Loaded border color:', cardData.border_color);
            }
            
            // Load generation type from DB (fallback if not in params)
            if (cardData.generation_type && !loadedGenerationType) {
              if (cardData.generation_type === 'custom' && cardData.custom_generation_type_id) {
                setSelectedGenerationType(`custom_${cardData.custom_generation_type_id}`);
                setSelectedCustomGenerationType(cardData.custom_generation_type_id);
              } else {
                setSelectedGenerationType(cardData.generation_type);
              }
              log('Loaded generation type from DB:', cardData.generation_type);
            }
          }
        } catch (err) {
          logError('Failed to load visibility settings:', err);
        }
      };
      
      loadVisibilitySettings();
      
      // Log the loaded data for debugging
      log('Card data loaded successfully for editing');
    }
  }, [params.id, params.name, params.description, params.type, params.role, params.context, params.image_url]);

  // Handle preselected phenomena type for new cards
  useEffect(() => {
    if (params.preselected_type && !params.id) {
      // Only set preselected type for new cards (not editing)
      const preselectedType = params.preselected_type.toString();
      setType(preselectedType);
      setTypeInputValue(preselectedType); // Set input value to match preselected type
    }
  }, [params.preselected_type, params.id]);

  // Handle loading data from Card Inbox (when user clicks on a generation job)
  useEffect(() => {
    if (inboxJobId && !params.id) {
      log('📥 Loading card data from inbox, job ID:', inboxJobId);
      
      // Load all the card data from params
      if (params.name) setName(params.name.toString());
      if (params.description) setDescription(params.description.toString());
      if (params.image_description) setImageDescription(params.image_description.toString());
      const inboxType = params.type?.toString();
      if (inboxType) {
        setType(inboxType);
        setTypeInputValue(inboxType); // Set input value to match inbox type
      }
      const inboxRole = params.role?.toString();
      if (inboxRole) {
        setRole(inboxRole);
        setDetailInputValue(inboxRole); // Set detail input value to match inbox role
      }
      const inboxContext = params.context?.toString();
      if (inboxContext) {
        setContext(inboxContext);
        setContextInputValue(inboxContext); // Set context input value to match inbox context
      }
      if (params.border_style) setBorderStyle(params.border_style.toString());
      if (params.border_color) setBorderColor(params.border_color.toString());
      if (params.image_url) {
        setCardImage(params.image_url.toString());
        log('📥 Loaded completed image from inbox:', params.image_url.toString());
      }
      
      // Restore generation type from inbox params
      const inboxGenType = params.generation_type?.toString();
      const inboxCustomGenTypeId = params.custom_generation_type_id?.toString();
      if (inboxGenType) {
        if (inboxGenType === 'custom' && inboxCustomGenTypeId) {
          setSelectedGenerationType(`custom_${inboxCustomGenTypeId}`);
          setSelectedCustomGenerationType(inboxCustomGenTypeId);
        } else {
          setSelectedGenerationType(inboxGenType);
        }
        log('📥 Restored generation type from inbox:', inboxGenType);
      }
      
      // Store the job ID so we can delete it after saving
      setGenerationJobId(inboxJobId);
      
      log('📥 Card data loaded from inbox successfully');
    }
  }, [inboxJobId, params.id]);

  // Check auth status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setAuthChecking(true);
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // log('No active session found on component mount');
        } else {
          // log('Active session found on component mount');
        }
      } catch (err: unknown) {
        logError('Error checking auth status:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  // Load phenomena types, custom detail options, custom contexts, and custom border styles on component mount
  useEffect(() => {
    loadPhenomenaTypes();
    loadCustomDetailOptions();
    loadCustomContexts();
    loadCustomBorderStyles();
    loadCustomGenerationTypes();
  }, []);

  // Also reload all custom data when screen is focused (in case they were updated elsewhere)
  useFocusEffect(
    useCallback(() => {
      loadPhenomenaTypes();
      loadCustomDetailOptions();
      loadCustomContexts();
      loadCustomBorderStyles();
      loadCustomGenerationTypes();
    }, [])
  );

  if (!fontsLoaded) {
    return null;
  }

  // Debug logging removed to reduce console spam

  const queueImageGeneration = async (generationType: boolean | 'classic' | 'modern_parchment' | 'custom') => {
    // Sync input values before generating - ensures typed values are captured
    const syncedValues = syncInputValues();
    
    log('🚀 queueImageGeneration called with generationType:', generationType);
    log('📝 Current form state:', { name, imageDescription, type: syncedValues.type, role: syncedValues.role, context: syncedValues.context, borderStyle });
    
    if (!name || !imageDescription) {
      log('❌ Missing required fields:', { name: !!name, imageDescription: !!imageDescription });
      setError('Please provide a card name and image description.');
      return;
    }

    log('✅ Form validation passed, starting generation...');
    setIsGenerating(true);
    setError('');

    try {
      log('🔄 Refreshing session...');
      
      // Add timeout to prevent hanging on session refresh
      const sessionPromise = refreshSession();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session refresh timed out')), 10000)
      );
      
      const currentSession = await Promise.race([sessionPromise, timeoutPromise]) as Awaited<ReturnType<typeof refreshSession>>;
      
      if (!currentSession?.user?.id) {
        throw new Error('Authentication required. Please log in again.');
      }
      
      log('✅ Session refreshed successfully');

      // Determine generation parameters based on type
      const isPremium = generationType === true;
      const isClassic = generationType === 'classic';
      const isModernParchment = generationType === 'modern_parchment';
      const isCustom = generationType === 'custom';
      
      // Include all data needed to create the card automatically after image generation
      const isPublic = visibility.includes('public');
      const isSharedWithFriends = visibility.includes('friends');
      
      const cardDetails = {
        name,
        description,
        imageDescription,
        type: syncedValues.type,
        role: syncedValues.role,
        context: syncedValues.context,
        borderStyle,
        borderColor,
        format,
        isPremium: isPremium || isCustom,  // Custom types should use premium quality
        generationType: isCustom ? 'custom' : (isModernParchment ? 'modern_parchment' : (isClassic ? 'classic' : (isPremium ? 'premium' : 'legacy'))),
        customGenerationTypeId: isCustom ? selectedCustomGenerationType : null,
        // Additional fields for automatic card creation
        visibility,
        backgroundGradient: JSON.stringify(backgroundGradient),
        isPublic,
        isSharedWithFriends,
        // For shadow card linking
        shadowForCardId: shadowForCardId || null,
        // For return navigation after card creation
        returnTo: returnTo || null,
        returnZone: returnZone || null,
      };

      log('🎨 Starting image generation for:', cardDetails);
      log('👤 User ID:', currentSession.user.id);
      log('📤 Calling queue-image-generation function...');

      const { data, error } = await supabase.functions.invoke('queue-image-generation', {
        body: { 
          userId: currentSession.user.id,
          cardData: cardDetails
        },
      });

      log('📥 Function response:', { data, error });

      if (error) {
        logError('❌ Edge function error:', error);
        throw error;
      }

      setGenerationJobId(data.jobId);
      setIsPremiumGeneration(isPremium || isClassic || isModernParchment);

      Alert.alert(
        'Card Generation Started!',
        'Your card is being created in the background. Once the image is generated, your card will automatically appear in your Cards collection. Check the Card Inbox for progress.',
        [
          { text: 'View Inbox', onPress: () => router.push('/(tabs)/card-inbox') },
          { text: 'OK' }
        ]
      );

    } catch (err) {
      logError('❌ Error queueing image generation:', err);
      logError('❌ Error details:', JSON.stringify(err, null, 2));
      setError(`Failed to start image generation: ${err instanceof Error ? err.message : 'Unknown error'}`);
      logError('Error details:', err);
    } finally {
      log('🏁 Generation attempt finished, setting isGenerating to false');
      setIsGenerating(false);
    }
  };

  // Old synchronous generation functions are now deprecated by the queue system.
  // They are kept here for reference but should be removed later.
  const generateEnhancedImage_DEPRECATED = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    if (!imageDescription) {
      setError('Please provide an image description');
      return;
    }

    setIsGenerating(true);
    setError('');
    setErrorDetails('');

    // Activate KeepAwake to prevent screen sleep during generation
    try {
      activateKeepAwake('image-generation');
      log('KeepAwake activated for enhanced image generation');
    } catch (keepAwakeError) {
      logError('Failed to activate KeepAwake:', keepAwakeError);
    }

    try {
      setAuthChecking(true);

      const currentSession = await refreshSession();

      if (!currentSession || !currentSession.access_token) {
        logError('No valid session found after refresh attempt');
        throw new Error('You must be logged in to generate images');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-enhanced-card`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: imageDescription,
            type,
            role,
            context,
            format,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        logError('Server error response (enhanced):', errorData);
        setError(errorData.error || `Failed to generate enhanced image: ${response.status}`);
        setErrorDetails(errorData.details || `Server responded with status: ${response.status}`);
        throw new Error(errorData.error || 'Failed to generate enhanced image');
      }

      const data = await response.json();

      if (!data.imageUrl) {
        logError('No image URL in enhanced response:', data);
        throw new Error('No image URL received');
      }

      setCardImage(data.imageUrl);
      setIsPremiumGeneration(true); // Flag this as premium generation
      setIsUploadedImage(false); // Clear uploaded flag since this is AI generated
    } catch (err) {
      logError('Enhanced image generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGenerating(false);
      setAuthChecking(false);
      
      // Deactivate KeepAwake when generation completes
      try {
        deactivateKeepAwake('image-generation');
        log('KeepAwake deactivated after enhanced image generation');
      } catch (keepAwakeError) {
        logError('Failed to deactivate KeepAwake:', keepAwakeError);
      }
    }
  };

  const generateImage_DEPRECATED = async () => {
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    if (!imageDescription) {
      setError('Please provide an image description');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    setErrorDetails('');

    // Activate KeepAwake to prevent screen sleep during generation
    try {
      activateKeepAwake('image-generation');
      log('KeepAwake activated for legacy image generation');
    } catch (keepAwakeError) {
      logError('Failed to activate KeepAwake:', keepAwakeError);
    }

    try {
      setAuthChecking(true);
      
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        logError('No valid session found after refresh attempt');
        throw new Error('You must be logged in to generate images');
      }
      
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-card-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: imageDescription,

            userId: currentSession.user.id
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        logError('Server error response:', errorData);
        setError(errorData.error || `Failed to generate image: ${response.status}`);
        setErrorDetails(errorData.details || `Server responded with status: ${response.status}`);
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();

      if (!data.imageUrl) {
        logError('No image URL in response:', data);
        throw new Error('No image URL received');
      }

      setCardImage(data.imageUrl);
      setIsPremiumGeneration(false); // Flag this as legacy generation
      setIsUploadedImage(false); // Clear uploaded flag since this is AI generated
    } catch (err) {
      logError('Image generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGenerating(false);
      setAuthChecking(false);
      
      // Deactivate KeepAwake when generation completes
      try {
        deactivateKeepAwake('image-generation');
        log('KeepAwake deactivated after legacy image generation');
      } catch (keepAwakeError) {
        logError('Failed to deactivate KeepAwake:', keepAwakeError);
      }
    }
  };

  // Chat functionality functions
  const initializeChat = () => {
    if (cardImage) {
      const initialMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: "I've generated your card image! How would you like to refine or modify it? You can ask me to adjust colors, style, composition, or any other aspect.",
        imageUrl: cardImage
      };
      setChatMessages([initialMessage]);
      setShowChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: chatInput.trim()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to use chat');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-image-generation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: chatInput.trim(),
            cardImageUrl: cardImage,
            cardName: name,
            originalDescription: imageDescription || name,

          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process chat message');
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.message || "I've updated your image based on your request.",
        imageUrl: data.imageUrl
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      
      if (data.imageUrl) {
        setCardImage(data.imageUrl);
      }

    } catch (err) {
      logError('Chat error:', err);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const closeChat = () => {
    setShowChat(false);
    setChatMessages([]);
    setCurrentResponseId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const detectImageOrientation = (width: number, height: number): 'portrait' | 'landscape' | 'square' => {
    const ratio = width / height;
    if (ratio > 1.1) return 'landscape';
    if (ratio < 0.9) return 'portrait';
    return 'square';
  };

  const uploadImageWithCropping = async (aspectRatio: [number, number] | null = null) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload images.'
        );
        return;
      }

      // Launch image picker with specific aspect ratio if provided
      const pickerOptions: any = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      };
      
      // Add aspect ratio for Android (iOS ignores this)
      if (aspectRatio) {
        pickerOptions.aspect = aspectRatio;
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (!result.canceled && result.assets?.[0]) {
        await processUploadedImage(result.assets[0]);
      }
    } catch (err) {
      logError('Image picker error:', err);
      setError('Failed to access image library. Please try again.');
    }
  };

  const uploadImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload images.'
        );
        return;
      }

      // Launch image picker without editing to detect orientation first
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Don't edit yet, we'll handle cropping
        quality: 1.0, // Keep high quality for orientation detection
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const orientation = detectImageOrientation(asset.width || 1, asset.height || 1);
        
        log('Image orientation detected:', orientation, 'Dimensions:', asset.width, 'x', asset.height);
        
        // If image is portrait and we're in full-bleed mode, show cropping options
        if (orientation === 'portrait' && format === 'fullBleed') {
          setTempImageUri(asset.uri);
          setImageOrientation(orientation);
          setShowImageCropModal(true);
          return;
        }
        
        // For landscape/square or framed format, process directly
        await processUploadedImage(asset);
      }
    } catch (err) {
      logError('Image picker error:', err);
      setError('Failed to access image library. Please try again.');
    }
  };

  const processUploadedImage = async (asset: any) => {
    const imageUri = asset.uri;
    
    // Set loading state
    setIsGenerating(true);
    setError('');
    
    try {
          // Get current session with better error handling
          const currentSession = await refreshSession();
          
          if (!currentSession?.user?.id) {
            throw new Error('Authentication required. Please log in again.');
          }

          log('Starting image upload for user:', currentSession.user.id);

          // Generate unique filename
          const timestamp = Date.now();

          // Create file object for React Native upload (no blob conversion needed)
          const fileExtension = imageUri.split('.').pop() || 'jpg';
          const mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
          
          // For React Native, create a file-like object
          const file = {
            uri: imageUri,
            type: mimeType,
            name: `uploaded_${timestamp}.${fileExtension}`,
          } as any;
          const fileName = `${currentSession.user.id}/uploaded_${timestamp}.${fileExtension}`;
          
          log('Uploading file:', fileName, 'with type:', mimeType);
          
          // Upload to Supabase Storage with better error handling
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('card_images')
            .upload(fileName, file, {
              contentType: mimeType,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            logError('Supabase upload error:', uploadError);
            
            // Handle specific error types
            if (uploadError.message?.includes('JWT')) {
              throw new Error('Authentication expired. Please log in again.');
            } else if (uploadError.message?.includes('policy')) {
              throw new Error('Permission denied. Please check your account settings.');
            } else {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }
          }

          log('Upload successful:', uploadData);

          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('card_images')
            .getPublicUrl(fileName);

          if (!publicUrl) {
            throw new Error('Failed to generate public URL for uploaded image');
          }

          log('Generated public URL:', publicUrl);

          // Set the uploaded image URL
          setCardImage(publicUrl);
          setIsUploadedImage(true); // Flag this as user-uploaded image
          
          // Show success feedback
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
        log('Image upload completed successfully');
        
      } catch (uploadErr) {
        logError('Image upload error:', uploadErr);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to upload image. Please try again.';
        
        if (uploadErr instanceof Error) {
          if (uploadErr.message.includes('Authentication') || uploadErr.message.includes('JWT')) {
            errorMessage = 'Please log in again and try uploading.';
          } else if (uploadErr.message.includes('Permission') || uploadErr.message.includes('policy')) {
            errorMessage = 'Upload permission denied. Please contact support.';
          } else if (uploadErr.message.includes('network') || uploadErr.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else {
            errorMessage = uploadErr.message;
          }
        }
        
        setError(errorMessage);
      } finally {
        setIsGenerating(false);
      }
  };

  const handleCropSelection = async (cropOption: { name: string, ratio: [number, number] | null, description: string }) => {
    setShowImageCropModal(false);
    
    if (cropOption.ratio) {
      // Re-launch image picker with specific aspect ratio
      await uploadImageWithCropping(cropOption.ratio);
    } else {
      // Use original image without additional cropping
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });
      
      if (!result.canceled && result.assets?.[0]) {
        await processUploadedImage(result.assets[0]);
      }
    }
  };

  const handleGenerateDescription = async () => {
    log('📝 Generate Description button pressed');
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    setIsGeneratingDescription(true);
    setError('');
    setErrorDetails('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to generate a description');
      }

      const { data, error } = await supabase.functions.invoke('generate-card-description', {
        body: { 
          cardName: name,
          cardType: type !== 'TBD' ? type : undefined
        },
      });

      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      if (!data || !data.description) {
        throw new Error('No description was generated');
      }
      
      setDescription(data.description);
    } catch (err) {
      logError('Description generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerateImageDescription = async () => {
    log('🖼️ Generate Image Description button pressed');
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    setIsGeneratingImageDescription(true);
    setError('');
    setErrorDetails('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession || !currentSession.access_token) {
        throw new Error('You must be logged in to generate an image description');
      }

      const { data, error } = await supabase.functions.invoke('generate-image-description', {
        body: { 
          cardName: name,
          cardType: type !== 'TBD' ? type : undefined,
          cardDescription: description || undefined
        },
      });

      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      if (!data || !data.imageDescription) {
        throw new Error('No image description was generated');
      }
      
      setImageDescription(data.imageDescription);
    } catch (err) {
      logError('Image description generation error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsGeneratingImageDescription(false);
    }
  };

  // Functions for adding new items inline
  const addNewType = async (typeName?: string) => {
    const trimmedInput = (typeName || newTypeInput).trim();
    if (!trimmedInput) {
      setError('Please enter a type name');
      return;
    }

    if (typeOptions.includes(trimmedInput)) {
      setError('This type already exists');
      return;
    }

    try {
      const updatedTypes = [...typeOptions, trimmedInput];
      setTypeOptions(updatedTypes);
      
      // Save to database
      await savePhenomenaTypes(updatedTypes);
      
      // Select the new type and update input
      setType(trimmedInput);
      setTypeInputValue(trimmedInput); // Set input value for auto-complete field
      setRole(''); // Reset detail when type changes
      setNewTypeInput('');
      setShowNewTypeInput(false);
      setShowTypeSuggestions(false); // Hide suggestions when new type is added
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logError('Error adding new type:', error);
      setError('Failed to add new type. Please try again.');
    }
  };

  const addNewDetail = async (detailName?: string) => {
    const trimmedInput = (detailName || newDetailInput).trim();
    if (!trimmedInput || !type) {
      setError('Please enter a detail name and select a type first');
      return;
    }

    if (roleOptions.includes(trimmedInput)) {
      setError('This detail already exists for this type');
      return;
    }

    try {
      const updatedCustomOptions = {
        ...customDetailOptions,
        [type]: [...(customDetailOptions[type] || []), trimmedInput]
      };
      
      setCustomDetailOptions(updatedCustomOptions);
      
      // Save to database
      await saveCustomDetailOptions(updatedCustomOptions);
      
      // Select the new detail and update input
      setRole(trimmedInput);
      setDetailInputValue(trimmedInput); // Set input value for auto-complete field
      setNewDetailInput('');
      setShowNewDetailInput(false);
      setShowDetailSuggestions(false); // Hide suggestions when new detail is added
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logError('Error adding new detail:', error);
      setError('Failed to add new detail. Please try again.');
    }
  };

  const addNewContext = async (contextName?: string) => {
    const trimmedInput = (contextName || newContextInput).trim();
    if (!trimmedInput) {
      setError('Please enter a context name');
      return;
    }

    if (contextOptions.includes(trimmedInput)) {
      setError('This context already exists');
      return;
    }

    try {
      const updatedContexts = [...customContexts, trimmedInput];
      setCustomContexts(updatedContexts);
      
      // Save to database
      await saveCustomContexts(updatedContexts);
      
      // Select the new context and update input
      setContext(trimmedInput);
      setContextInputValue(trimmedInput); // Set input value for auto-complete field
      setNewContextInput('');
      setShowNewContextInput(false);
      setShowContextSuggestions(false); // Hide suggestions when new context is added
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logError('Error adding new context:', error);
      setError('Failed to add new context. Please try again.');
    }
  };

  const addNewBorderStyle = async () => {
    const trimmedInput = newBorderStyleInput.trim();
    if (!trimmedInput) {
      setError('Please enter a border style name');
      return;
    }

    if (borderStyleOptions.includes(trimmedInput)) {
      setError('This border style already exists');
      return;
    }

    try {
      const updatedBorderStyles = [...customBorderStyles, trimmedInput];
      setCustomBorderStyles(updatedBorderStyles);
      
      // Save to database
      await saveCustomBorderStyles(updatedBorderStyles);
      
      // Select the new border style and clear input
      setBorderStyle(trimmedInput);
      setNewBorderStyleInput('');
      setShowNewBorderStyleInput(false);
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logError('Error adding new border style:', error);
      setError('Failed to add new border style. Please try again.');
    }
  };

  // Save functions for database persistence
  const savePhenomenaTypes = async (types: string[]) => {
    try {
      if (!user) {
        logError('No user found for saving phenomena types');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ custom_phenomena_types: types })
        .eq('id', user.id);

      if (error) {
        logError('Error saving phenomena types to database:', error);
        throw error;
      }
    } catch (error) {
      logError('Error saving phenomena types:', error);
      throw error;
    }
  };

  const saveCustomDetailOptions = async (options: Record<string, string[]>) => {
    try {
      if (!user) {
        logError('No user found for saving detail options');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ custom_detail_options: options })
        .eq('id', user.id);

      if (error) {
        logError('Error saving detail options to database:', error);
        throw error;
      }
    } catch (error) {
      logError('Error saving detail options:', error);
      throw error;
    }
  };

  const saveCustomContexts = async (contexts: string[]) => {
    try {
      if (!user) {
        logError('No user found for saving contexts');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ custom_contexts: contexts })
        .eq('id', user.id);

      if (error) {
        logError('Error saving contexts to database:', error);
        throw error;
      }
    } catch (error) {
      logError('Error saving contexts:', error);
      throw error;
    }
  };

  const saveCustomBorderStyles = async (borderStyles: string[]) => {
    try {
      if (!user) {
        logError('No user found for saving border styles');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ custom_border_styles: borderStyles })
        .eq('id', user.id);

      if (error) {
        logError('Error saving border styles to database:', error);
        throw error;
      }
    } catch (error) {
      logError('Error saving border styles:', error);
      throw error;
    }
  };



  const handleSave = async () => {
    // Sync input values before saving - ensures typed values are captured
    const syncedValues = syncInputValues();
    
    if (!name) {
      setError('Please provide a card name');
      return;
    }

    if (!cardImage) {
      setError('Please generate or provide an image');
      return;
    }

    if (visibility.length === 0) {
      setError('Please select at least one visibility option');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const currentSession = await refreshSession();
      
      if (!currentSession) {
        throw new Error('You must be logged in to create cards');
      }

      const { data: existingCollections, error: collectionError } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', currentSession.user.id)
        .contains('visibility', visibility)
        .limit(1);

      if (collectionError) throw collectionError;

      let collectionId;

      if (existingCollections && existingCollections.length > 0) {
        collectionId = existingCollections[0].id;
      } else {
        const { data: newCollection, error: createCollectionError } = await supabase
          .from('collections')
          .insert({
            name: 'My Collection',
            user_id: currentSession.user.id,
            visibility: visibility
          })
          .select('id')
          .single();

        if (createCollectionError) throw createCollectionError;
        collectionId = newCollection.id;
      }

      const isPublic = visibility.includes('public');
      const isSharedWithFriends = visibility.includes('friends');
      
      const cardData = {
        name,
        description: description || '',
        image_description: imageDescription || '', // Save image description for editing
        type: syncedValues.type || 'Card',
        phenomena: syncedValues.type || null,
        role: syncedValues.role || 'General',
        context: syncedValues.context || 'Fantasy',
        border_style: borderStyle || 'Classic',
        border_color: borderColor || '#808080',
        image_url: cardImage,
        format,
        frame_color: DEFAULT_FRAME_COLOR,
        is_premium_generation: isPremiumGeneration, // Track if this uses premium generation
        custom_generation_type_id: selectedCustomGenerationType, // Track custom generation type if used
        is_uploaded_image: isUploadedImage, // Track if this is a user-uploaded image
        generation_type: selectedGenerationType?.startsWith('custom_') ? 'custom' : selectedGenerationType, // Track the generation type used
        // Only save background gradient if user selected something other than default black
        ...(JSON.stringify(backgroundGradient) !== JSON.stringify(['#1a1a1a', '#000000']) && {
          background_gradient: JSON.stringify(backgroundGradient)
        }),
        user_id: currentSession.user.id,
        collection_id: collectionId,
        is_public: isPublic,
        is_shared_with_friends: isSharedWithFriends
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('cards')
          .update(cardData)
          .eq('id', params.id)
          .eq('user_id', currentSession.user.id);

        if (updateError) throw updateError;
        
        setSuccessMessage('Card updated successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          if (returnTo === 'cards') {
            router.replace('/(tabs)');
          } else {
            router.replace('/');
          }
        }, 1500);
      } else {
        log('Creating new card with data:', cardData);
        const { data: newCard, error: insertError } = await supabase
          .from('cards')
          .insert(cardData)
          .select()
          .single();

        if (insertError) {
          logError('Card creation error:', insertError);
          throw insertError;
        }
        
        log('Card created successfully:', newCard);
        
        // If this card came from the inbox, delete the generation job from the queue
        if (generationJobId) {
          log('📥 Deleting generation job from queue:', generationJobId);
          const { error: deleteJobError } = await supabase
            .from('image_generation_queue')
            .delete()
            .eq('id', parseInt(generationJobId));
          
          if (deleteJobError) {
            logError('Error deleting generation job:', deleteJobError);
            // Don't throw - the card was created successfully
          } else {
            log('📥 Generation job deleted from queue');
          }
          setGenerationJobId(null);
        }
        
        // If this card is being created as a shadow for another card, link them
        if (shadowForCardId && newCard) {
          log('Linking shadow card:', newCard.id, 'to original card:', shadowForCardId);
          const { error: linkError } = await supabase
            .from('cards')
            .update({ shadow_card_id: newCard.id })
            .eq('id', shadowForCardId)
            .eq('user_id', currentSession.user.id);
            
          if (linkError) {
            logError('Error linking shadow card:', linkError);
            // Don't throw error - the card was created successfully, just the linking failed
          } else {
            log('Shadow card linked successfully');
          }
        }
        
        resetForm();
        
        const successMsg = shadowForCardId ? 'Shadow card created and linked successfully!' : 'Card created successfully!';
        setSuccessMessage(successMsg);
        setTimeout(() => {
          setSuccessMessage('');
          if (returnTo === 'spread' && returnZone) {
            log('Navigating back to spread with card ID:', newCard?.id, 'and zone:', returnZone);
            router.replace({
              pathname: '/spread',
              params: { 
                autoAddCardData: JSON.stringify(newCard),
                autoAddZone: returnZone
              }
            });
          } else if (returnTo === 'deck-detail') {
            const returnPhenomena = params.returnPhenomena as string;
            router.replace({
              pathname: '/deck-detail',
              params: {
                type: returnPhenomena
              }
            });
          } else {
            router.replace('/');
          }
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      logError('Card operation error:', err);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleBack = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    log('handleBack called - draftId:', draftId, 'isDraftLoadedRef:', isDraftLoadedRef.current, 'isDraftLoading:', isDraftLoading);
    
    // If editing an existing draft
    if (draftId) {
      // If draft hasn't loaded yet, don't save - just navigate back
      if (!isDraftLoadedRef.current) {
        log('Draft not loaded yet, navigating back without saving');
        performBackNavigation();
        return;
      }
      
      // Draft is loaded, auto-save and navigate back
      await updateExistingDraft();
      performBackNavigation();
      return;
    }
    
    // Check if there are unsaved changes (new card only)
    if (hasUnsavedChanges) {
      setShowSaveDraftModal(true);
    } else {
      // No unsaved changes, navigate back normally
      performBackNavigation();
    }
  };

  // Update an existing draft in the database
  const updateExistingDraft = async () => {
    try {
      log('updateExistingDraft called - user:', user?.id, 'draftId:', draftId);
      
      if (!user || !draftId) {
        log('Cannot update draft - missing user or draftId');
        return;
      }

      // Use current state values, but fall back to loaded draft data if state is still default
      // This handles the case where React state updates haven't propagated yet
      const loadedData = loadedDraftDataRef.current;
      
      // Check if name is still the default - if so, use loaded data
      const isStateStillDefault = name === '' || name === 'Untitled Card Draft';
      
      const draftData = {
        name: (isStateStillDefault && loadedData?.name) ? loadedData.name : (name.trim() || 'Untitled Card Draft'),
        description: (isStateStillDefault && loadedData?.description !== undefined) ? loadedData.description : description.trim(),
        image_description: (isStateStillDefault && loadedData?.image_description !== undefined) ? loadedData.image_description : imageDescription.trim(),
        type: (isStateStillDefault && loadedData?.type) ? loadedData.type : type,
        role: (isStateStillDefault && loadedData?.role !== undefined) ? loadedData.role : role.trim(),
        context: (isStateStillDefault && loadedData?.context) ? loadedData.context : context,
        image_url: (isStateStillDefault && loadedData?.image_url !== undefined) ? loadedData.image_url : cardImage,
        format: (isStateStillDefault && loadedData?.format) ? loadedData.format : format,
        background_gradient: (isStateStillDefault && loadedData?.background_gradient) ? loadedData.background_gradient : JSON.stringify(backgroundGradient),
        border_style: (isStateStillDefault && loadedData?.border_style) ? loadedData.border_style : borderStyle,
        border_color: (isStateStillDefault && loadedData?.border_color) ? loadedData.border_color : borderColor,
        visibility: (isStateStillDefault && loadedData?.visibility) ? loadedData.visibility : visibility,
        is_uploaded_image: (isStateStillDefault && loadedData?.is_uploaded_image !== undefined) ? loadedData.is_uploaded_image : isUploadedImage,
        last_modified: new Date().toISOString()
      };

      log('Auto-saving draft:', draftId, 'isStateStillDefault:', isStateStillDefault);
      log('Draft data to save:', JSON.stringify(draftData, null, 2));

      const { data, error } = await supabase
        .from('card_drafts')
        .update(draftData)
        .eq('id', draftId)
        .select();

      if (error) {
        logError('Error updating draft:', error.message, error.code, error.details);
      } else {
        log('Draft auto-saved successfully, result:', data);
      }
    } catch (err) {
      logError('Error in updateExistingDraft:', err);
    }
  };

  const performBackNavigation = () => {
    // Navigate back to the appropriate tab based on returnTo parameter
    if (returnTo === 'cards') {
      router.push('/(tabs)');
    } else if (returnTo === 'card-inbox') {
      router.push('/(tabs)/card-inbox');
    } else if (returnTo === 'deck-detail') {
      const returnPhenomena = params.returnPhenomena as string;
      router.push({
        pathname: '/deck-detail',
        params: {
          type: returnPhenomena
        }
      });
    } else {
      router.push('/(tabs)/create');
    }
  };

  const checkTableExists = async () => {
    try {
      log('Checking if card_drafts table exists...');
      const { data, error } = await supabase
        .from('card_drafts')
        .select('id')
        .limit(1);
      
      log('Table check result - data:', data, 'error:', error);
      
      if (error) {
        logError('Table check error:', error.message, error.code, error.details);
        return false;
      }
      return true;
    } catch (err) {
      logError('Table check exception:', err);
      return false;
    }
  };

  const saveDraft = async () => {
    try {
      log('Starting saveDraft...');
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save drafts.');
        return;
      }

      log('User ID:', user.id);

      // Check if the card_drafts table exists
      const tableExists = await checkTableExists();
      log('Table exists:', tableExists);
      
      if (!tableExists) {
        Alert.alert(
          'Database Setup Required',
          'The card drafts feature needs to be set up. Please run the database migration:\n\n1. Go to Supabase Dashboard\n2. Open SQL Editor\n3. Run migration: 20250810120000_create_card_drafts_table.sql\n\nThis is a one-time setup step.'
        );
        return;
      }

      const draftData = {
        user_id: user.id,
        name: name.trim() || 'Untitled Card Draft',
        description: description.trim(),
        image_description: imageDescription.trim(),
        type,
        role: role.trim(),
        context,
        image_url: cardImage,
        format,
        background_gradient: JSON.stringify(backgroundGradient),
        border_style: borderStyle,
        border_color: borderColor,
        visibility,
        is_uploaded_image: isUploadedImage,
        draft_type: 'card',
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      };

      log('Attempting to save draft with data:', JSON.stringify(draftData, null, 2));

      const { data, error } = await supabase
        .from('card_drafts')
        .insert(draftData)
        .select()
        .single();

      log('Insert result - data:', data, 'error:', error);

      if (error) {
        logError('Error saving draft - message:', error.message, 'code:', error.code, 'details:', error.details, 'hint:', error.hint);
        Alert.alert('Error', `Failed to save draft: ${error.message || JSON.stringify(error)}`);
        return;
      }

      log('Draft saved successfully:', data);
      Alert.alert('Draft Saved', 'Your card draft has been saved to your inbox.');
      setShowSaveDraftModal(false);
      performBackNavigation();
    } catch (err) {
      logError('Error in saveDraft:', err);
      Alert.alert('Error', `An unexpected error occurred: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
  };

  const discardChanges = () => {
    setShowSaveDraftModal(false);
    performBackNavigation();
  };

  return (
    <>
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Card' : 'Create Card'}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.formContainer}>
          <View style={styles.assistedToggleRow}>
            <Text style={styles.assistedToggleLabel}>Assisted mode</Text>
            <View style={styles.assistedToggleRight}>
              {assistedMode && (
                <View style={styles.assistedTag}>
                  <Text style={styles.assistedTagText}>Typeform-style flow</Text>
                </View>
              )}
              <Switch
                value={assistedMode}
                onValueChange={(value) => {
                  setAssistedMode(value);
                  if (value) {
                    setAssistedStep(0);
                  }
                }}
              />
            </View>
          </View>

          {assistedMode && (
            <View style={styles.assistedStepContainer}>
              <Text style={styles.assistedStepIndicator}>
                Step {assistedStep + 1} of {assistedStepMeta.length}
              </Text>
              <Text style={styles.assistedStepTitle}>
                {assistedStepMeta[assistedStep]?.title}
              </Text>
              <Text style={styles.assistedStepSubtitle}>
                {assistedStepMeta[assistedStep]?.subtitle}
              </Text>

              {assistedStep === 0 && (
                <TextInput
                  style={styles.assistedStepInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter card name"
                  placeholderTextColor="#666"
                />
              )}

              {assistedStep === 1 && (
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.assistedStepInput, styles.assistedStepTextArea, styles.textAreaWithIcon]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe what this card reveals or how it should be used"
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[
                      styles.inputIcon,
                      (!name || isGeneratingDescription) && styles.inputIconDisabled,
                    ]}
                    onPress={handleGenerateDescription}
                    disabled={!name || isGeneratingDescription}
                  >
                    {isGeneratingDescription ? (
                      <ActivityIndicator color="#6366f1" size="small" />
                    ) : (
                      <Wand2
                        size={16}
                        color={(!name || isGeneratingDescription) ? '#666' : '#6366f1'}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {assistedStep === 2 && (
                <>
                  <TextInput
                    style={styles.assistedStepInput}
                    value={typeInputValue}
                    onChangeText={(text) => {
                      setTypeInputValue(text);
                      setType(text);
                      handleTypeInputChange(text);
                    }}
                    placeholder="Start typing to search or create type..."
                    placeholderTextColor="#666"
                  />

                  {typeInputValue.trim().length > 0 && filteredTypeOptions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                        {filteredTypeOptions.map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.suggestionItem,
                              type === option && styles.suggestionItemSelected,
                            ]}
                            onPress={() => {
                              handleTypeSelection(option);
                              setTypeInputValue(option);
                            }}
                          >
                            <Text
                              style={[
                                styles.suggestionText,
                                type === option && styles.suggestionTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                            {type === option && <Check size={16} color="#6366f1" />}
                          </TouchableOpacity>
                        ))}

                        {typeInputValue.trim() &&
                          !filteredTypeOptions.includes(typeInputValue.trim()) && (
                            <TouchableOpacity
                              style={styles.suggestionItem}
                              onPress={() => addNewType(typeInputValue.trim())}
                            >
                              <Plus size={14} color="#6366f1" />
                              <Text style={styles.createNewText}>
                                Create "{typeInputValue.trim()}"
                              </Text>
                            </TouchableOpacity>
                          )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {assistedStep === 3 && (
                <>
                  <TextInput
                    style={styles.assistedStepInput}
                    value={detailInputValue}
                    onChangeText={(text) => {
                      setDetailInputValue(text);
                      setRole(text);
                      handleDetailInputChange(text);
                    }}
                    placeholder="Start typing to search or create detail..."
                    placeholderTextColor="#666"
                  />

                  {detailInputValue.trim().length > 0 && filteredDetailOptions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                        {filteredDetailOptions.map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.suggestionItem,
                              role === option && styles.suggestionItemSelected,
                            ]}
                            onPress={() => {
                              handleDetailSelection(option);
                              setDetailInputValue(option);
                            }}
                          >
                            <Text
                              style={[
                                styles.suggestionText,
                                role === option && styles.suggestionTextSelected,
                              ]}
                            >
                              {option}
                            </Text>
                            {role === option && <Check size={16} color="#6366f1" />}
                          </TouchableOpacity>
                        ))}

                        {detailInputValue.trim() &&
                          !filteredDetailOptions.includes(detailInputValue.trim()) && (
                            <TouchableOpacity
                              style={styles.suggestionItem}
                              onPress={() => addNewDetail(detailInputValue.trim())}
                            >
                              <Plus size={14} color="#6366f1" />
                              <Text style={styles.createNewText}>
                                Create "{detailInputValue.trim()}"
                              </Text>
                            </TouchableOpacity>
                          )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {assistedStep === 4 && (
                <>
                  <TextInput
                    style={styles.assistedStepInput}
                    value={contextInputValue}
                    onChangeText={(text) => {
                      setContextInputValue(text);
                      setContext(text);
                      handleContextInputChange(text);
                    }}
                    placeholder="Start typing to search or create context..."
                    placeholderTextColor="#666"
                  />

                  {contextInputValue.trim().length > 0 &&
                    filteredContextOptions.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <ScrollView
                          style={styles.suggestionsScroll}
                          nestedScrollEnabled={true}
                        >
                          {filteredContextOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={[
                                styles.suggestionItem,
                                context === option && styles.suggestionItemSelected,
                              ]}
                              onPress={() => {
                                handleContextSelection(option);
                                setContextInputValue(option);
                              }}
                            >
                              <Text
                                style={[
                                  styles.suggestionText,
                                  context === option && styles.suggestionTextSelected,
                                ]}
                              >
                                {option}
                              </Text>
                              {context === option && <Check size={16} color="#6366f1" />}
                            </TouchableOpacity>
                          ))}

                          {contextInputValue.trim() &&
                            !filteredContextOptions.includes(
                              contextInputValue.trim(),
                            ) && (
                              <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() =>
                                  addNewContext(contextInputValue.trim())
                                }
                              >
                                <Plus size={14} color="#6366f1" />
                                <Text style={styles.createNewText}>
                                  Create "{contextInputValue.trim()}"
                                </Text>
                              </TouchableOpacity>
                            )}
                        </ScrollView>
                      </View>
                    )}
                </>
              )}

              {assistedStep === 5 && (
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.assistedStepInput, styles.assistedStepTextArea, styles.textAreaWithIcon]}
                    value={imageDescription}
                    onChangeText={setImageDescription}
                    placeholder="Describe the image you want on the card"
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[
                      styles.inputIcon,
                      (!name || isGeneratingImageDescription) && styles.inputIconDisabled,
                    ]}
                    onPress={handleGenerateImageDescription}
                    disabled={!name || isGeneratingImageDescription}
                  >
                    {isGeneratingImageDescription ? (
                      <ActivityIndicator color="#6366f1" size="small" />
                    ) : (
                      <Wand2
                        size={16}
                        color={(!name || isGeneratingImageDescription) ? '#666' : '#6366f1'}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {assistedStep === 6 && (
                <View style={styles.assistedGenerateContainer}>
                  <Text style={styles.assistedGenerateSummaryLabel}>Ready to generate</Text>
                  <Text style={styles.assistedGenerateSummaryText}>
                    We'll use your card name, description, type, detail, context, and image
                    description with the currently selected generation type.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      (!name || !imageDescription || isGenerating) &&
                        styles.generateButtonDisabled,
                    ]}
                    onPress={() => {
                      log(
                        `🎯 Assisted Generate Image button pressed - ${selectedGenerationType.toUpperCase()}`,
                      );
                      log('📋 Button state:', {
                        name: !!name,
                        imageDescription: !!imageDescription,
                        isGenerating,
                      });
                      log('📝 Form values:', { name, imageDescription });

                      if (!name || !imageDescription || isGenerating) {
                        return;
                      }

                      if (selectedGenerationType === 'legacy') {
                        log('🎨 Legacy generation selected (assisted)');
                        setFormat('framed');
                        queueImageGeneration(false);
                      } else if (selectedGenerationType === 'premium') {
                        log(
                          '🃏 Premium Classic generation selected (assisted, enhanced prompt)',
                        );
                        setFormat('fullBleed');
                        queueImageGeneration(true);
                      } else if (selectedGenerationType === 'classic') {
                        log(
                          '💎 Full Bleed generation selected (assisted, classic function)',
                        );
                        setFormat('fullBleed');
                        queueImageGeneration('classic');
                      } else if (selectedGenerationType === 'modern_parchment') {
                        log(
                          '📜 Modern Parchment generation selected (assisted, queue system)',
                        );
                        setFormat('fullBleed');
                        queueImageGeneration('modern_parchment');
                      } else if (selectedGenerationType?.startsWith('custom_')) {
                        const customTypeId = selectedGenerationType.replace('custom_', '');
                        log('🎨 Custom generation type selected (assisted):', customTypeId);
                        setSelectedCustomGenerationType(customTypeId);
                        setFormat('fullBleed');
                        queueImageGeneration('custom');
                      }
                    }}
                    disabled={!name || !imageDescription || isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Wand2
                          size={18}
                          color="#fff"
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.generateButtonText}>Generate Image</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.assistedGenerateHint}>
                    After generating, you can fine-tune details in the advanced view or with
                    AI chat.
                  </Text>
                </View>
              )}

              {assistedStep > 0 && (
                <View style={styles.assistedPreviewContainer}>
                  <Text style={styles.assistedPreviewHeading}>Card so far</Text>

                  {name ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Title</Text>
                      <Text style={styles.assistedPreviewValue}>{name}</Text>
                    </View>
                  ) : null}

                  {assistedStep > 1 && description ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Description</Text>
                      <Text style={styles.assistedPreviewValue}>{description}</Text>
                    </View>
                  ) : null}

                  {assistedStep > 2 && type ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Type</Text>
                      <Text style={styles.assistedPreviewValue}>{type}</Text>
                    </View>
                  ) : null}

                  {assistedStep > 3 && role ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Detail</Text>
                      <Text style={styles.assistedPreviewValue}>{role}</Text>
                    </View>
                  ) : null}

                  {assistedStep > 4 && context ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Context</Text>
                      <Text style={styles.assistedPreviewValue}>{context}</Text>
                    </View>
                  ) : null}

                  {assistedStep > 5 && imageDescription ? (
                    <View style={styles.assistedPreviewRow}>
                      <Text style={styles.assistedPreviewLabel}>Image Description</Text>
                      <Text style={styles.assistedPreviewValue}>{imageDescription}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.assistedNavRow}>
                <TouchableOpacity
                  style={[styles.assistedNavButton, styles.assistedNavButtonSecondary, assistedStep === 0 && styles.assistedNavButtonDisabled]}
                  disabled={assistedStep === 0}
                  onPress={() => {
                    const prevStep = Math.max(0, assistedStep - 1);
                    setAssistedStep(prevStep);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Text style={styles.assistedNavButtonSecondaryText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.assistedNavButton}
                  onPress={() => {
                    if (assistedStep < assistedStepMeta.length - 1) {
                      const nextStep = Math.min(assistedStepMeta.length - 1, assistedStep + 1);
                      setAssistedStep(nextStep);
                    } else {
                      setAssistedMode(false);
                    }
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                >
                  <Text style={styles.assistedNavButtonText}>
                    {assistedStep < assistedStepMeta.length - 1 ? 'Next' : 'Done'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!assistedMode && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Card Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter card name"
                  placeholderTextColor="#666"
                />
              </View>

          {/* Generation Type Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Generation Type</Text>
            <TouchableOpacity 
              style={styles.dropdownSelector}
              onPress={() => setShowGenerationTypeDropdown(!showGenerationTypeDropdown)}
            >
              <Text style={styles.dropdownSelectorText}>
                {generationTypeOptions.find(option => option.key === selectedGenerationType)?.label}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            
            {showGenerationTypeDropdown && (
              <View style={styles.dropdown}>
                {generationTypeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedGenerationType(option.key);
                      // Automatically enable full bleed for all premium generation types
                      if (option.key !== 'legacy') {
                        setFormat('fullBleed');
                      } else {
                        setFormat('framed');
                      }
                      // If it's a custom generation type, extract and set the ID
                      if (option.key.startsWith('custom_')) {
                        const customTypeId = option.key.replace('custom_', '');
                        setSelectedCustomGenerationType(customTypeId);
                      } else {
                        setSelectedCustomGenerationType(null);
                      }
                      setShowGenerationTypeDropdown(false);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <View style={styles.dropdownItemContent}>
                      <Text style={styles.dropdownItemTitle}>{option.label}</Text>
                      <Text style={styles.dropdownItemDescription}>{option.description}</Text>
                    </View>
                    {selectedGenerationType === option.key && (
                      <Check size={20} color="#6366f1" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Background Color Selector - Only for Legacy generation */}
          {selectedGenerationType === 'legacy' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Background Color</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector}
                onPress={() => setShowBackgroundDropdown(!showBackgroundDropdown)}
              >
                <View style={styles.backgroundDropdownContent}>
                  <LinearGradient
                    colors={backgroundGradient as [string, string, ...string[]]}
                    style={styles.backgroundPreviewSmall}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={styles.dropdownText}>
                    {GRADIENT_OPTIONS.find(g => JSON.stringify(g.colors) === JSON.stringify(backgroundGradient))?.name || 'Select background'}
                  </Text>
                </View>
                <ChevronDown size={20} color="#666" />
              </TouchableOpacity>
              
              {showBackgroundDropdown && (
                <View style={styles.dropdown}>
                  {GRADIENT_OPTIONS.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setBackgroundGradient(item.colors);
                        setShowBackgroundDropdown(false);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                      }}
                    >
                      <View style={styles.backgroundDropdownItemContent}>
                        <LinearGradient
                          colors={item.colors as [string, string, ...string[]]}
                          style={styles.backgroundPreviewSmall}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <Text style={styles.dropdownItemText}>{item.name}</Text>
                      </View>
                      {JSON.stringify(backgroundGradient) === JSON.stringify(item.colors) && (
                        <Check size={20} color="#6366f1" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Type Selection - Auto-completing Input */}
          <View style={styles.inlineSelectionGroup}>
            <Text style={styles.inlineSelectionLabel}>Type</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.typeInput}
                value={typeInputValue}
                onChangeText={handleTypeInputChange}
                onSubmitEditing={handleTypeSubmit}
                placeholder="Start typing to search or create type..."
                placeholderTextColor="#666"
                returnKeyType="done"
                onFocus={() => {
                  if (typeInputValue.trim()) {
                    handleTypeInputChange(typeInputValue);
                  }
                }}
                onBlur={() => {
                  // Sync input value to actual type state when user taps away
                  const inputValue = typeInputValue.trim();
                  if (inputValue && inputValue !== type) {
                    setType(inputValue);
                    setShowTypeSuggestions(false);
                  }
                }}
              />
              {typeInputValue.trim() && (
                <TouchableOpacity
                  style={styles.clearInputButton}
                  onPress={() => {
                    setTypeInputValue('');
                    setType('');
                    setRole('');
                    setShowTypeSuggestions(false);
                  }}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Auto-complete suggestions */}
            {showTypeSuggestions && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                  {filteredTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.suggestionItem,
                        type === option && styles.suggestionItemSelected
                      ]}
                      onPress={() => handleTypeSelection(option)}
                    >
                      <Text style={[
                        styles.suggestionText,
                        type === option && styles.suggestionTextSelected
                      ]}>
                        {option}
                      </Text>
                      {type === option && (
                        <Check size={16} color="#6366f1" />
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  {/* Option to create new type if input doesn't match existing */}
                  {typeInputValue.trim() && !filteredTypeOptions.includes(typeInputValue.trim()) && (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => addNewType(typeInputValue.trim())}
                    >
                      <Plus size={14} color="#6366f1" />
                      <Text style={styles.createNewText}>
                        Create "{typeInputValue.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Detail Selection - Auto-completing Input */}
          <View style={styles.inlineSelectionGroup}>
            <Text style={styles.inlineSelectionLabel}>Detail {type ? `(${type})` : ''}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.typeInput}
                value={detailInputValue}
                onChangeText={handleDetailInputChange}
                onSubmitEditing={handleDetailSubmit}
                placeholder="Start typing to search or create detail..."
                placeholderTextColor="#666"
                returnKeyType="done"
                onFocus={() => {
                  if (detailInputValue.trim()) {
                    handleDetailInputChange(detailInputValue);
                  }
                }}
                onBlur={() => {
                  // Sync input value to actual role state when user taps away
                  const inputValue = detailInputValue.trim();
                  if (inputValue && inputValue !== role) {
                    setRole(inputValue);
                    setShowDetailSuggestions(false);
                  }
                }}
              />
              {detailInputValue.trim() && (
                <TouchableOpacity
                  style={styles.clearInputButton}
                  onPress={() => {
                    setDetailInputValue('');
                    setRole('');
                    setShowDetailSuggestions(false);
                  }}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Auto-complete suggestions */}
            {showDetailSuggestions && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                  {filteredDetailOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.suggestionItem,
                        role === option && styles.suggestionItemSelected
                      ]}
                      onPress={() => handleDetailSelection(option)}
                    >
                      <Text style={[
                        styles.suggestionText,
                        role === option && styles.suggestionTextSelected
                      ]}>
                        {option}
                      </Text>
                      {role === option && (
                        <Check size={16} color="#6366f1" />
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  {/* Option to create new detail if input doesn't match existing */}
                  {detailInputValue.trim() && !filteredDetailOptions.includes(detailInputValue.trim()) && (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => addNewDetail(detailInputValue.trim())}
                    >
                      <Plus size={14} color="#6366f1" />
                      <Text style={styles.createNewText}>
                        Create "{detailInputValue.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Context Selection - Auto-completing Input */}
          <View style={styles.inlineSelectionGroup}>
            <Text style={styles.inlineSelectionLabel}>Context</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.typeInput}
                value={contextInputValue}
                onChangeText={handleContextInputChange}
                onSubmitEditing={handleContextSubmit}
                placeholder="Start typing to search or create context..."
                placeholderTextColor="#666"
                returnKeyType="done"
                onFocus={() => {
                  if (contextInputValue.trim()) {
                    handleContextInputChange(contextInputValue);
                  }
                }}
                onBlur={() => {
                  // Sync input value to actual context state when user taps away
                  const inputValue = contextInputValue.trim();
                  if (inputValue && inputValue !== context) {
                    setContext(inputValue);
                    setShowContextSuggestions(false);
                  }
                }}
              />
              {contextInputValue.trim() && (
                <TouchableOpacity
                  style={styles.clearInputButton}
                  onPress={() => {
                    setContextInputValue('');
                    setContext('');
                    setShowContextSuggestions(false);
                  }}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Auto-complete suggestions */}
            {showContextSuggestions && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                  {filteredContextOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.suggestionItem,
                        context === option && styles.suggestionItemSelected
                      ]}
                      onPress={() => handleContextSelection(option)}
                    >
                      <Text style={[
                        styles.suggestionText,
                        context === option && styles.suggestionTextSelected
                      ]}>
                        {option}
                      </Text>
                      {context === option && (
                        <Check size={16} color="#6366f1" />
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  {/* Option to create new context if input doesn't match existing */}
                  {contextInputValue.trim() && !filteredContextOptions.includes(contextInputValue.trim()) && (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => addNewContext(contextInputValue.trim())}
                    >
                      <Plus size={14} color="#6366f1" />
                      <Text style={styles.createNewText}>
                        Create "{contextInputValue.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Border Style Selection - Hidden for custom generation types */}
          {!selectedGenerationType.startsWith('custom_') && (
          <View style={styles.inlineSelectionGroup}>
            <TouchableOpacity 
              style={styles.collapsibleHeader}
              onPress={() => {
                setShowBorderStyleOptions(!showBorderStyleOptions);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Text style={styles.inlineSelectionLabel}>Border Style</Text>
              <View style={styles.collapsibleHeaderRight}>
                <Text style={styles.selectedValueText}>{borderStyle || 'Select border style'}</Text>
                <ChevronDown 
                  size={16} 
                  color="#666" 
                  style={[styles.chevronIcon, showBorderStyleOptions && styles.chevronIconRotated]} 
                />
              </View>
            </TouchableOpacity>
            
            {showBorderStyleOptions && (
              <View style={styles.chipContainer}>
                {borderStyleOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.chip,
                      borderStyle === option && styles.chipSelected
                    ]}
                    onPress={() => {
                      setBorderStyle(option);
                      setShowBorderStyleOptions(false); // Collapse after selection
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      borderStyle === option && styles.chipTextSelected
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, styles.addChip]}
                  onPress={() => setShowNewBorderStyleInput(!showNewBorderStyleInput)}
                >
                  <Plus size={14} color="#6366f1" />
                  <Text style={styles.addChipText}>Add Border Style</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {showNewBorderStyleInput && (
              <View style={styles.newItemInput}>
                <TextInput
                  style={styles.newItemTextInput}
                  value={newBorderStyleInput}
                  onChangeText={setNewBorderStyleInput}
                  placeholder="Enter new border style name"
                  placeholderTextColor="#666"
                  onSubmitEditing={() => addNewBorderStyle()}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={addNewBorderStyle}
                >
                  <Check size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          )}

          {/* Border Color Selection - Hidden for custom generation types */}
          {!selectedGenerationType.startsWith('custom_') && (
          <View style={styles.inlineSelectionGroup}>
            <TouchableOpacity 
              style={styles.collapsibleHeader}
              onPress={() => {
                setShowBorderColorOptions(!showBorderColorOptions);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Text style={styles.inlineSelectionLabel}>Border Color</Text>
              <View style={styles.collapsibleHeaderRight}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: borderColor,
                    borderWidth: 1,
                    borderColor: '#444'
                  }} />
                  <Text style={styles.selectedValueText}>
                    {borderColorOptions.find(opt => opt.color === borderColor)?.name || 'Custom'}
                  </Text>
                </View>
                <ChevronDown 
                  size={16} 
                  color="#666" 
                  style={[styles.chevronIcon, showBorderColorOptions && styles.chevronIconRotated]} 
                />
              </View>
            </TouchableOpacity>
            
            {showBorderColorOptions && (
              <View style={styles.colorOptionsGrid}>
                {borderColorOptions.map((option) => (
                  <TouchableOpacity
                    key={option.name}
                    style={[
                      styles.colorOption,
                      borderColor === option.color && styles.colorOptionSelected
                    ]}
                    onPress={() => {
                      setBorderColor(option.color);
                      setShowBorderColorOptions(false);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <View style={[
                      styles.colorSwatch,
                      { backgroundColor: option.color }
                    ]} />
                    <Text style={[
                      styles.colorOptionText,
                      borderColor === option.color && styles.colorOptionTextSelected
                    ]}>
                      {option.name}
                    </Text>
                    {borderColor === option.color && (
                      <View style={styles.colorCheckmark}>
                        <Check size={12} color="#6366f1" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          )}

          {/* Image Section */}
          <View style={[styles.cardPreview, format === 'fullBleed' && styles.cardPreviewFullBleed]}>
            {isGenerating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Generating Image...</Text>
              </View>
            ) : (
              <>
                <Image
                  source={{ uri: cardImage || DEFAULT_IMAGE }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                {format === 'fullBleed' && (
                  <>
                    {name ? (
                      <Text style={styles.fullBleedName} numberOfLines={1}>{name}</Text>
                    ) : null}
                    {type ? <Text style={[styles.fullBleedCorner, styles.topLeft]}>{type}</Text> : null}
                    {role ? <Text style={[styles.fullBleedCorner, styles.bottomLeft]}>{role}</Text> : null}
                    {description ? (
                      <Text style={styles.fullBleedDescription} numberOfLines={3}>{description}</Text>
                    ) : null}
                  </>
                )}
              </>
            )}
          </View>

          <View style={styles.imageButtonsContainer}>
            <TouchableOpacity 
              style={[styles.generateButton, (!name || !imageDescription || isGenerating) && styles.generateButtonDisabled]} 
              onPress={() => {
                log(`🎯 Generate Image button pressed - ${selectedGenerationType.toUpperCase()}`);
                log('📋 Button state:', { name: !!name, imageDescription: !!imageDescription, isGenerating });
                log('📝 Form values:', { name, imageDescription });
                
                // Execute the selected generation type directly
                if (selectedGenerationType === 'legacy') {
                  log('🎨 Legacy generation selected');
                  setFormat('framed');
                  queueImageGeneration(false);
                } else if (selectedGenerationType === 'premium') {
                  log('🃏 Premium Classic generation selected (using enhanced prompt)');
                  setFormat('fullBleed');
                  queueImageGeneration(true); // Use enhanced function for premium classic
                } else if (selectedGenerationType === 'classic') {
                  log('💎 Full Bleed generation selected (using classic function)');
                  setFormat('fullBleed');
                  queueImageGeneration('classic'); // Use classic function for full bleed
                } else if (selectedGenerationType === 'modern_parchment') {
                  log('📜 Modern Parchment generation selected (using queue system)');
                  setFormat('fullBleed');
                  queueImageGeneration('modern_parchment');
                } else if (selectedGenerationType?.startsWith('custom_')) {
                  const customTypeId = selectedGenerationType.replace('custom_', '');
                  log('🎨 Custom generation type selected:', customTypeId);
                  setSelectedCustomGenerationType(customTypeId);
                  setFormat('fullBleed');
                  queueImageGeneration('custom');
                }
              }}
              disabled={!name || !imageDescription || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Wand2 size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.generateButtonText}>Generate</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={uploadImage}
            >
              <Upload size={18} color="#6366f1" style={styles.buttonIcon} />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Chat Button - appears after image generation */}
          {cardImage && (
            <TouchableOpacity 
              style={styles.chatButton}
              onPress={initializeChat}
            >
              <Text style={styles.chatButtonText}>💬 Refine with AI Chat</Text>
            </TouchableOpacity>
          )}

          {/* Card Format Toggle */}
          <View style={styles.formatToggleContainer}>
            <Pressable
              style={[styles.formatOption, format === 'framed' && styles.formatOptionSelected]}
              onPress={() => setFormat('framed')}
            >
              <Text style={[styles.formatOptionText, format === 'framed' && styles.formatOptionTextSelected]}>Classic</Text>
            </Pressable>
            <Pressable
              style={[styles.formatOption, format === 'fullBleed' && styles.formatOptionSelected]}
              onPress={() => setFormat('fullBleed')}
            >
              <Text style={[styles.formatOptionText, format === 'fullBleed' && styles.formatOptionTextSelected]}>Full-bleed</Text>
            </Pressable>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Image Description <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={[styles.input, styles.textArea, styles.textAreaWithIcon]}
                placeholder="Describe the image you want to generate"
                placeholderTextColor="#666"
                value={imageDescription}
                onChangeText={setImageDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity 
                style={[styles.inputIcon, (!name || isGeneratingImageDescription) && styles.inputIconDisabled]}
                onPress={handleGenerateImageDescription}
                disabled={!name || isGeneratingImageDescription}
              >
                {isGeneratingImageDescription ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <Wand2 size={16} color={(!name || isGeneratingImageDescription) ? "#666" : "#6366f1"} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card Description <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter card description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity 
              style={[styles.generateButton, styles.descriptionButton, (!name || isGeneratingDescription) && styles.generateButtonDisabled]} 
              onPress={handleGenerateDescription}
              disabled={!name || isGeneratingDescription}
            >
              {isGeneratingDescription ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Wand2 size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.generateButtonText}>Generate Description</Text>
                </>
              )}
            </TouchableOpacity>
          </View>




          <View style={styles.inputGroup}>
            <Text style={styles.label}>Visibility Settings</Text>
            <View style={styles.visibilityOptions}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('personal') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('personal')) {
                    setVisibility([...visibility, 'personal']);
                  } else if (visibility.length > 1) {
                    setVisibility(visibility.filter(v => v !== 'personal'));
                  }
                }}
              >
                <Lock size={20} color={visibility.includes('personal') ? '#6366f1' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('personal') && styles.visibilityTextSelected
                ]}>Personal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('friends') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('friends')) {
                    setVisibility([...visibility, 'friends']);
                  } else {
                    setVisibility(visibility.filter(v => v !== 'friends'));
                  }
                }}
              >
                <Users size={20} color={visibility.includes('friends') ? '#ec4899' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('friends') && styles.visibilityTextSelected
                ]}>Friends</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  visibility.includes('public') && styles.visibilityOptionSelected,
                ]}
                onPress={() => {
                  if (!visibility.includes('public')) {
                    setVisibility([...visibility, 'public']);
                  } else {
                    setVisibility(visibility.filter(v => v !== 'public'));
                  }
                }}
              >
                <Globe2 size={20} color={visibility.includes('public') ? '#10b981' : '#666'} />
                <Text style={[
                  styles.visibilityText,
                  visibility.includes('public') && styles.visibilityTextSelected
                ]}>Public</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {errorDetails && <Text style={styles.errorDetailsText}>{errorDetails}</Text>}
          {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          {/* Only show Create Card button when editing OR when user uploaded an image */}
          {(isEditing || isUploadedImage) && (
            <TouchableOpacity 
              style={[styles.saveButton, isCreating && styles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Card'}</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
        </View>
      </ScrollView>

      {/* Image Cropping Modal */}
      <Modal
        visible={showImageCropModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageCropModal(false)}
      >
        <View style={styles.cropModalOverlay}>
          <View style={styles.cropModalContainer}>
            <View style={styles.cropModalHeader}>
              <Text style={styles.cropModalTitle}>Portrait Image Detected</Text>
              <TouchableOpacity 
                onPress={() => setShowImageCropModal(false)}
                style={styles.cropModalCloseButton}
              >
                <Text style={styles.cropModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.cropModalDescription}>
              Your image is in portrait orientation. For best results in full-bleed cards, choose how you'd like to crop it:
            </Text>
            
            {tempImageUri ? (
              <View style={styles.cropImagePreview}>
                <Image 
                  source={{ uri: tempImageUri }} 
                  style={styles.cropPreviewImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}
            
            <View style={styles.cropOptionsContainer}>
              {cropPresets.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.cropOption}
                  onPress={() => handleCropSelection(option)}
                >
                  <View style={styles.cropOptionContent}>
                    <Text style={styles.cropOptionName}>{option.name}</Text>
                    <Text style={styles.cropOptionDescription}>{option.description}</Text>
                    {option.ratio && (
                      <Text style={styles.cropOptionRatio}>
                        {option.ratio[0]}:{option.ratio[1]} ratio
                      </Text>
                    )}
                  </View>
                  <View style={styles.cropOptionArrow}>
                    <Text style={styles.cropOptionArrowText}>→</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Refine Your Image</Text>
            <TouchableOpacity onPress={closeChat} style={styles.chatCloseButton}>
              <Text style={styles.chatCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.chatMessages} showsVerticalScrollIndicator={false}>
            {chatMessages.map((message) => (
              <View key={message.id} style={[
                styles.chatMessage,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              ]}>
                {message.imageUrl && (
                  <Image source={{ uri: message.imageUrl }} style={styles.chatImage} />
                )}
                <Text style={[
                  styles.chatMessageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
                ]}>
                  {message.content}
                </Text>
              </View>
            ))}
            {isChatLoading && (
              <View style={[styles.chatMessage, styles.assistantMessage]}>
                <ActivityIndicator color="#6366f1" size="small" />
                <Text style={styles.assistantMessageText}>Thinking...</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask me to adjust colors, style, composition..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.chatSendButton, (!chatInput.trim() || isChatLoading) && styles.chatSendButtonDisabled]}
              onPress={sendChatMessage}
              disabled={!chatInput.trim() || isChatLoading}
            >
              <Text style={styles.chatSendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>

    {/* Save Draft Confirmation Modal */}
    <Modal
      visible={showSaveDraftModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSaveDraftModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.saveDraftModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Save Draft?</Text>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              You have unsaved changes to your card. Would you like to save this as a draft and continue working on it later?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={discardChanges}
              >
                <Text style={styles.cancelButtonText}>Discard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveDraft}
              >
                <Text style={styles.saveButtonText}>Save Draft</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40, // Same width as back button for balance
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formContainer: {
    padding: 16,
  },
  assistedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  assistedToggleLabel: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  assistedToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assistedTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 4,
  },
  assistedTagText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  assistedStepContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  assistedStepIndicator: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  assistedStepTitle: {
    color: '#E5E7EB',
    fontSize: 18,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  assistedStepSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  assistedStepInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  assistedStepTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  assistedNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  assistedNavButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
  },
  assistedNavButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  assistedNavButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  assistedNavButtonSecondaryText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  assistedNavButtonDisabled: {
    opacity: 0.4,
  },
  assistedGenerateContainer: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 12,
  },
  assistedGenerateSummaryLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  assistedGenerateSummaryText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  assistedGenerateHint: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  assistedPreviewContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#111827',
    gap: 6,
  },
  assistedPreviewHeading: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
  },
  assistedPreviewRow: {
    gap: 2,
  },
  assistedPreviewLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  assistedPreviewValue: {
    color: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  required: {
    color: '#ff4444',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'Inter-Regular',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
  },
  descriptionButton: {
    backgroundColor: '#2563eb',
  },
  generateButtonDisabled: {
    backgroundColor: '#4a4a4a',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  uploadButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  /* ---- Card Format Toggle ---- */
  formatToggleContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  formatOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  formatOptionSelected: {
    backgroundColor: '#6366f1',
  },
  formatOptionText: {
    color: '#6366f1',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  formatOptionTextSelected: {
    color: '#fff',
  },
  /* ---- Full-bleed preview overlay ---- */
  cardPreviewFullBleed: {
    borderWidth: 0,
  },
  fullBleedName: {
    position: 'absolute',
    top: 8,
    right: 8,
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullBleedCorner: {
    position: 'absolute',
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  topLeft: { top: 8, left: 8 },
  bottomLeft: { bottom: 8, left: 8 },
  fullBleedDescription: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    width: '60%',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardPreview: {
    height: 250,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  errorText: {
    color: '#ff4444',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  errorDetailsText: {
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  successText: {
    color: '#22c55e',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#4a4a4a',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  placeholderText: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    width: '80%',
    maxHeight: '60%',
  },
  genChoiceModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: '85%',
    gap: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  genChoiceTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  genChoiceButton: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  genChoiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  genChoiceButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  genChoiceButtonSecondaryText: {
    color: '#6366f1',
  },
  genChoiceButtonClassic: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  genChoiceButtonClassicText: {
    color: '#10b981',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  visibilityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  visibilityOptionSelected: {
    backgroundColor: '#2a2a2a',
    borderColor: '#6366f1',
  },
  visibilityText: {
    color: '#999',
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  visibilityTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  chatButton: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  chatTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  chatCloseButton: {
    padding: 8,
  },
  chatCloseText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatMessage: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#6366f1',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#222',
    alignSelf: 'flex-start',
  },
  chatMessageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#fff',
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    padding: 12,
    borderRadius: 20,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  chatSendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#333',
  },
  chatSendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  /* ---- Gradient Selector ---- */
  gradientOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  gradientOption: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  gradientOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#1a1a2e',
  },
  gradientPreview: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginBottom: 8,
  },
  gradientName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  gradientCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  /* ---- Compact Dropdowns ---- */
  compactDropdownsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  compactDropdownGroup: {
    flex: 1,
  },
  compactLabel: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  compactDropdownSelector: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  compactDropdownText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  /* ---- Background Dropdown ---- */
  backgroundDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backgroundPreviewSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 12,
  },
  backgroundDropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  /* ---- Input with Icon ---- */
  inputWithIcon: {
    position: 'relative',
  },
  textAreaWithIcon: {
    paddingRight: 48, // Space for icon
  },
  inputIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  /* ---- Image Crop Modal ---- */
  cropModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cropModalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  cropModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cropModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  cropModalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  cropModalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  cropModalDescription: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 20,
  },
  cropImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
  },
  cropPreviewImage: {
    width: '100%',
    height: '100%',
  },
  cropOptionsContainer: {
    gap: 12,
  },
  cropOption: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333',
  },
  cropOptionContent: {
    flex: 1,
  },
  cropOptionName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  cropOptionDescription: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 2,
  },
  cropOptionRatio: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  cropOptionArrow: {
    marginLeft: 12,
  },
  cropOptionArrowText: {
    color: '#6366f1',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  
  // Inline selection UI styles
  inlineSelectionGroup: {
    marginBottom: 24,
  },
  inlineSelectionLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
  },
  chipTextSelected: {
    color: '#fff',
  },
  addChip: {
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  addChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6366f1',
  },
  newItemInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  newItemTextInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
  },
  // Auto-complete input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    padding: 0, // Remove default padding since container has it
  },
  clearInputButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearInputText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    marginTop: -1, // Connect with input border
  },
  suggestionsScroll: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 8,
  },
  suggestionItemSelected: {
    backgroundColor: '#2a2a2a',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
  },
  suggestionTextSelected: {
    color: '#6366f1',
    fontFamily: 'Inter-Bold',
  },
  createNewText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6366f1',
  },
  addItemButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Collapsible section styles
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  collapsibleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedValueText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
  },
  chevronIcon: {
    transform: [{ rotate: '0deg' }],
  },
  chevronIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  
  dropdownSelectorText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  dropdownItemDescription: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  
  // Color option styles
  colorOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    minWidth: '45%',
  },
  colorOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1e2e',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  colorOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ccc',
  },
  colorOptionTextSelected: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  colorCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e8e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Save Draft Modal Styles
  saveDraftModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalContent: {
    padding: 20,
  },
  modalMessage: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  });
