package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.AccountDto;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.services.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public AccountDto me(@AuthenticationPrincipal Principal principal) {
        System.out.println("GET /api/accounts/me called");
        System.out.println("Principal: " + (principal != null ? principal.getName() : "null"));
        
        // For Google OAuth2, principal.getName() is the email
        Account me = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        List<String> roles = me.getAuthorities()
                .stream()
                .map(Authority::getName)
                .toList();

        return new AccountDto(
                me.getId(),
                me.getEmail(),
                me.getFirstName(),
                me.getLastName(),
                roles
        );
    }

    @PutMapping("/me/role")
    @PreAuthorize("isAuthenticated()")
    public AccountDto updateRole(
            @AuthenticationPrincipal Principal principal,
            @RequestBody Map<String, String> request
    ) {
        String role = request.get("role");
        Account account = accountService.findByEmail(principal.getName())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        // Update the user's role
        accountService.updateUserRole(account, role);

        List<String> roles = account.getAuthorities()
                .stream()
                .map(Authority::getName)
                .toList();

        return new AccountDto(
                account.getId(),
                account.getEmail(),
                account.getFirstName(),
                account.getLastName(),
                roles
        );
    }
}
