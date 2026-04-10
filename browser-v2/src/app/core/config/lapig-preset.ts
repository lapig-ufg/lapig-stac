import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const LapigPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#f0f9f1',
            100: '#d4eed6',
            200: '#a8ddb0',
            300: '#6DB56A',
            400: '#429B4D',
            500: '#429B4D',
            600: '#357E3F',
            700: '#296131',
            800: '#1B3A2A',
            900: '#132A1E',
            950: '#0A1A11'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '#429B4D',
                    inverseColor: '#FEFEFE',
                    hoverColor: '#357E3F',
                    activeColor: '#296131'
                },
                highlight: {
                    background: 'rgba(66, 155, 77, 0.12)',
                    focusBackground: 'rgba(66, 155, 77, 0.20)',
                    color: '#296131',
                    focusColor: '#1B3A2A'
                },
                surface: {
                    0: '#FEFEFE',
                    50: '#FBF8F1',
                    100: '#F6F1E7',
                    200: '#ECECEA',
                    300: '#E8DCC8',
                    400: '#D0D0CC',
                    500: '#ABABAA',
                    600: '#8A8A82',
                    700: '#6B6B65',
                    800: '#555550',
                    900: '#404040',
                    950: '#2D2D2A'
                }
            },
            dark: {
                primary: {
                    color: '#6DB56A',
                    inverseColor: '#1A1A18',
                    hoverColor: '#429B4D',
                    activeColor: '#357E3F'
                },
                highlight: {
                    background: 'rgba(109, 181, 106, 0.16)',
                    focusBackground: 'rgba(109, 181, 106, 0.24)',
                    color: '#6DB56A',
                    focusColor: '#a8ddb0'
                },
                surface: {
                    0: '#FEFEFE',
                    50: '#ECECEA',
                    100: '#D0D0CC',
                    200: '#ABABAA',
                    300: '#8A8A82',
                    400: '#6B6B65',
                    500: '#555550',
                    600: '#454542',
                    700: '#383835',
                    800: '#2A2A28',
                    900: '#1F1F1D',
                    950: '#141412'
                }
            }
        }
    }
});
