import { Stack } from 'expo-router';

export default function CustomGenerationBuilderLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Custom Generation Builder',
          headerShown: false 
        }} 
      />
    </Stack>
  );
}
