package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.dto.AccountDto;
import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.services.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;

    @GetMapping("/me")
    public AccountDto me(Principal principal) {
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
}
