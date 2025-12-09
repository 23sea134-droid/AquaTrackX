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

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- Animation Values ---
  const logoScale = useRef(new Animated.Value(1)).current;
  const orb1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const orb3Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

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

    // Store animation references for cleanup
    animationRefs.current = [logoAnimation, orb1Animation, orb2Animation, orb3Animation];

    // Start all animations
    logoAnimation.start();
    orb1Animation.start();
    orb2Animation.start();
    orb3Animation.start();

    // Cleanup animations on unmount
    return () => {
      animationRefs.current.forEach(animation => {
        if (animation && typeof animation.stop === 'function') {
          animation.stop();
        }
      });
    };
  }, [logoScale, orb1Anim, orb2Anim, orb3Anim]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      const result = await authService.signIn(email.trim(), password);
      
      if (result.success) {
        // Navigation will be handled automatically by AuthContext
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password', 
      'Password reset feature will be available soon. Please contact support if needed.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleSignupNavigation = () => {
    try {
      navigation.navigate('Signup');
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
            <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
              {/* Logo Image with rounded corners and glow effect */}
              <View style={styles.logoWrapper}>
                <Image 
                  source={require('../../assets/AquaTrackX_Logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
            <Text style={styles.title}>AquaTrackX</Text>
            <Text style={styles.subtitle}>Smart Water Monitoring System</Text>
          </View>

          {/* Main Form Card */}
          <BlurView intensity={20} tint="dark" style={styles.formCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.cardGradient}
            >
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue monitoring</Text>

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
                      placeholder="Email Address"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
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
                      placeholder="Password"
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      textContentType="password"
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

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledButton]}
                onPress={handleLogin}
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
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <Icon name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
            
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleSignupNavigation} activeOpacity={0.7}>
                <Text style={styles.signupLink}>Create Account</Text>
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
    top: height * 0.1,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
  },
  orb2: {
    position: 'absolute',
    top: height * 0.3,
    left: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(79, 195, 247, 0.4)',
  },
  orb3: {
    position: 'absolute',
    bottom: height * 0.2,
    right: width * 0.2,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 210, 63, 0.3)',
  },
  orb: {
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50, // Makes it perfectly rounded
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 15,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 45, // Also rounded to match the wrapper
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 24,
    marginBottom: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardGradient: {
    padding: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  inputGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 18,
    color: 'white',
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    borderRadius: 16,
    marginTop: 12,
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
    paddingVertical: 18,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 24,
  },
  forgotPasswordText: {
    color: '#4FC3F7',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomContainer: {
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginHorizontal: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signupText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  signupLink: {
    color: '#FFD23F',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;