package io.ATTTT.classGPT.config;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.repositories.AccountRepository;
import io.ATTTT.classGPT.repositories.AuthorityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Custom OAuth2 User Service that provisions or matches Google users to internal Account model.
 * On first Google login, creates a new Account with default role (ROLE_USER).
 * On subsequent logins, updates the Account with latest Google profile info.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final AccountRepository accountRepository;
    private final AuthorityRepository authorityRepository;

    /**
     * Load OAuth2 user (called for OAuth2 and OIDC providers like Google).
     */
    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);
        try {
            processOAuth2User(oAuth2User);
            return oAuth2User;
        } catch (Exception ex) {
            log.error("Failed to process OAuth2 user", ex);
            throw new OAuth2AuthenticationException("OAuth2 user processing failed: " + ex.getMessage());
        }
    }

    /**
     * Process the OAuth2 user:
     * - Extract email, name from Google profile
     * - Find or create Account in database
     * - Update user info
     */
    private void processOAuth2User(OAuth2User oAuth2User) {
        String email = oAuth2User.getAttribute("email");
        String givenName = oAuth2User.getAttribute("given_name");
        String familyName = oAuth2User.getAttribute("family_name");

        if (email == null || email.isBlank()) {
            throw new OAuth2AuthenticationException("Email not provided by OAuth2 provider");
        }

        log.info("Processing OAuth2 user: {}", email);

        // Find existing account or create new one
        Optional<Account> existingAccount = accountRepository.findByEmail(email);
        Account account;

        if (existingAccount.isPresent()) {
            // Update existing account with latest Google profile info
            account = existingAccount.get();
            log.info("Found existing account for email: {}", email);

            // Update name and picture if provided
            if (givenName != null && !givenName.isBlank()) {
                account.setFirstName(givenName);
            }
            if (familyName != null && !familyName.isBlank()) {
                account.setLastName(familyName);
            }
            // Note: You could store pictureUrl if your Account model has a field for it
        } else {
            // Create new account for first-time Google user
            log.info("Creating new account for Google user: {}", email);
            account = new Account();
            account.setEmail(email);
            account.setFirstName(givenName != null ? givenName : "");
            account.setLastName(familyName != null ? familyName : "");

            // Assign default role (ROLE_USER for students)
            Set<Authority> authorities = new HashSet<>();
            Authority userRole = authorityRepository.findById("ROLE_USER")
                    .orElseGet(() -> {
                        log.warn("ROLE_USER not found in database, creating default");
                        Authority newRole = new Authority();
                        newRole.setName("ROLE_USER");
                        return authorityRepository.save(newRole);
                    });
            authorities.add(userRole);
            account.setAuthorities(authorities);

            // Google users don't have a password; set a placeholder
            account.setPassword("");
        }

        // Save or update the account
        Account savedAccount = accountRepository.save(account);
        log.info("OAuth2 user provisioned/updated: {} (ID: {})", email, savedAccount.getId());
    }
}
