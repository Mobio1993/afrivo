from django import forms
from django.contrib.auth.forms import AuthenticationForm


class HotelAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label="Nom d'utilisateur",
        widget=forms.TextInput(
            attrs={
                "class": "auth-input",
                "placeholder": "Entrez votre nom d'utilisateur",
                "autocomplete": "username",
            }
        ),
    )
    password = forms.CharField(
        label="Mot de passe",
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "auth-input",
                "placeholder": "********",
                "autocomplete": "current-password",
                "id": "id_password",
            }
        ),
    )
    remember_me = forms.BooleanField(
        label="Se souvenir de moi",
        required=False,
        widget=forms.CheckboxInput(
            attrs={
                "class": "remember-input",
            }
        ),
    )
