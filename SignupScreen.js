import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { authService } from '../services/authService';

const { width, height } = Dimensions.get('window');

const SignupScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Animation Values ---
  const logoScale = useRef(new Animated.Value(1)).current;
  const orb1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb3Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb4Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Animation references for cleanup
  const animationRefs = useRef([]);

  // --- Animation Logic ---
  useEffect(() => {
    // Logo Pulsing Animation
    const logoAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Orb Floating Animation
    const createOrbAnimation = (anim) => {
      const xDest = (Math.random() - 0.5) * 50;
      const yDest = (Math.random() - 0.5) * 50;
      return Animated.loop(
          Animated.sequence([
              Animated.timing(anim, {
                  toValue: { x: xDest, y: yDest },
                  duration: 10000 + Math.random() * 5000,
                  easing: Easing.inOut(Easing.sin),
                  useNativeDriver: true,
              }),
              Animated.timing(anim, {
                  toValue: { x: 0, y: 0 },
                  duration: 10000 + Math.random() * 5000,
                  easing: Easing.inOut(Easing.sin),
                  useNativeDriver: true,
              })
          ])
      );
    };

    const orb1Animation = createOrbAnimation(orb1Anim);
    const orb2Animation = createOrbAnimation(orb2Anim);
    const orb3Animation = createOrbAnimation(orb3Anim);
    const orb4Animation = createOrbAnimation(orb4Anim);

    // Store animation references for cleanup
    animationRefs.current = [logoAnimation, orb1Animation, orb2Animation, orb3Animation, orb4Animation];

    // Start all animations
    logoAnimation.start();
    orb1Animation.start();
    orb2Animation.start();
    orb3Animation.start();
    orb4Animation.start();

    // Cleanup animations on unmount
    return () => {
      animationRefs.current.forEach(animation => {
        if (animation && typeof animation.stop === 'function') {
          animation.stop();
        }
      });
    };
  }, [logoScale, orb1Anim, orb2Anim, orb3Anim, orb4Anim]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const { name, email, password, confirmPassword } = formData;
    
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    
    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    
    // Enhanced password validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    // Phone number validation (if provided)
    if (formData.phoneNumber.trim()) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(formData.phoneNumber.trim())) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return false;
      }
    }
    
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      const result = await authService.signUp(
        formData.email.trim(),
        formData.password,
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phoneNumber: formData.phoneNumber.trim()
        }
      );
      
      if (result.success) {
        Alert.alert(
          'Success', 
          'Account created successfully!',
          [{ text: 'OK', style: 'default' }]
        );
        // Navigation will be handled automatically by AuthContext
      } else {
        Alert.alert('Signup Failed', result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error('Navigation error:', error);
      navigation.navigate('Login');
    }
  };

  const handleLoginNavigation = () => {
    try {
      navigation.navigate('Login');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // --- Animated Styles ---
  const animatedLogoStyle = {
    transform: [{ scale: logoScale }],
  };

  const orb1Style = {
    transform: orb1Anim.getTranslateTransform(),
  };
  const orb2Style = {
    transform: orb2Anim.getTranslateTransform(),
  };
  const orb3Style = {
    transform: orb3Anim.getTranslateTransform(),
  };
  const orb4Style = {
    transform: orb4Anim.getTranslateTransform(),
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0F1B3C', '#1A2550', '#0A1428']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Floating Orbs - Now Animated */}
      <Animated.View style={[styles.orb, styles.orb1, orb1Style]} />
      <Animated.View style={[styles.orb, styles.orb2, orb2Style]} />
      <Animated.View style={[styles.orb, styles.orb3, orb3Style]} />
      <Animated.View style={[styles.orb, styles.orb4, orb4Style]} />

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackNavigation}
              activeOpacity={0.7}
            >
              <BlurView intensity={20} tint="dark" style={styles.backButtonBlur}>
                <Icon name="arrow-back" size={24} color="#22D3EE" />
              </BlurView>
            </TouchableOpacity>
            
            <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
              {/* Logo Image with rounded corners and glow effect - Reduced size */}
              <View style={styles.logoWrapper}>
                <Image 
                  source={require('../../assets/AquaTrackX_Logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join AquaTrackX ecosystem today</Text>
          </View>

          {/* Main Form Card */}
          <BlurView intensity={20} tint="dark" style={styles.formCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.cardGradient}
            >
              <Text style={styles.formTitle}>Get Started</Text>
              <Text style={styles.formSubtitle}>Create your monitoring account</Text>

              {/* Name Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['rgba(79, 195, 247, 0.2)', 'rgba(41, 182, 246, 0.1)']}
                    style={styles.inputGradient}
                  >
                    <Icon name="person" size={20} color="#4FC3F7" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Full Name *"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={formData.name}
                      onChangeText={(value) => handleInputChange('name', value)}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                    />
                  </LinearGradient>
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['rgba(79, 195, 247, 0.2)', 'rgba(41, 182, 246, 0.1)']}
                    style={styles.inputGradient}
                  >
                    <Icon name="email" size={20} color="#4FC3F7" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Email Address *"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={formData.email}
                      onChangeText={(value) => handleInputChange('email', value)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  </LinearGradient>
                </View>
              </View>

              {/* Phone Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['rgba(79, 195, 247, 0.2)', 'rgba(41, 182, 246, 0.1)']}
                    style={styles.inputGradient}
                  >
                    <Icon name="phone" size={20} color="#4FC3F7" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Phone Number (Optional)"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={formData.phoneNumber}
                      onChangeText={(value) => handleInputChange('phoneNumber', value)}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                    />
                  </LinearGradient>
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['rgba(79, 195, 247, 0.2)', 'rgba(41, 182, 246, 0.1)']}
                    style={styles.inputGradient}
                  >
                    <Icon name="lock" size={20} color="#4FC3F7" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Password *"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={formData.password}
                      onChangeText={(value) => handleInputChange('password', value)}
                      secureTextEntry={!showPassword}
                      autoComplete="password-new"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Icon 
                        name={showPassword ? "visibility" : "visibility-off"} 
                        size={20} 
                        color="#4FC3F7" 
                      />
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <LinearGradient
                    colors={['rgba(79, 195, 247, 0.2)', 'rgba(41, 182, 246, 0.1)']}
                    style={styles.inputGradient}
                  >
                    <Icon name="lock-outline" size={20} color="#4FC3F7" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Confirm Password *"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={formData.confirmPassword}
                      onChangeText={(value) => handleInputChange('confirmPassword', value)}
                      secureTextEntry={!showConfirmPassword}
                      autoComplete="password-new"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity 
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Icon 
                        name={showConfirmPassword ? "visibility" : "visibility-off"} 
                        size={20} 
                        color="#4FC3F7" 
                      />
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.passwordHints}>
                <Text style={styles.hintText}>• Minimum 6 characters</Text>
                <Text style={styles.hintText}>• Passwords must match</Text>
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                style={[styles.signupButton, loading && styles.disabledButton]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B35', '#F7931E', '#FFD23F']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Text style={styles.signupButtonText}>Create Account</Text>
                      <Icon name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </BlurView>

          {/* Bottom Section */}
          <View style={styles.bottomContainer}>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleLoginNavigation} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  orb1: {
    position: 'absolute',
    top: '8%',
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
  },
  orb2: {
    position: 'absolute',
    top: '20%',
    left: -40,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(79, 195, 247, 0.4)',
  },
  orb3: {
    position: 'absolute',
    top: '45%',
    right: '10%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 210, 63, 0.3)',
  },
  orb4: {
    position: 'absolute',
    bottom: '20%',
    left: '15%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
  },
  orb: {
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)',
    overflow: 'hidden',
  },
  logoContainer: {
    marginBottom: 16,
    marginTop: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 80, // Reduced from 100
    height: 80, // Reduced from 100
    borderRadius: 40, // Half of width/height
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 }, // Reduced shadow offset
    shadowOpacity: 0.7, // Slightly reduced opacity
    shadowRadius: 15, // Reduced radius
    elevation: 12, // Reduced elevation
  },
  logoImage: {
    width: 70, // Reduced from 90
    height: 70, // Reduced from 90
    borderRadius: 35, // Half of width/height
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardGradient: {
    padding: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  inputGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
    color: 'white',
  },
  eyeIcon: {
    padding: 8,
  },
  passwordHints: {
    marginBottom: 18,
    paddingLeft: 4,
  },
  hintText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  signupButton: {
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  bottomContainer: {
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginHorizontal: 14,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  loginLink: {
    color: '#FFD23F',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default SignupScreen;