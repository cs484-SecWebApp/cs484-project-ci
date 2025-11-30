package io.ATTTT.classGPT.controllers;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.repositories.AuthorityRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.springframework.security.web.context.HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AccountService accountService;
    private final PasswordEncoder passwordEncoder;
    private final AuthorityRepository authorityRepository;

    @PostMapping("/login")
    public ResponseEntity<Account> login(@RequestBody RegisterRequest req, HttpServletRequest request) {
        String email = req.getEmail();

        Account account = accountService.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(req.getPassword(), account.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        List<SimpleGrantedAuthority> grantedAuthorities = account.getAuthorities().stream()
                .map(auth -> new SimpleGrantedAuthority(auth.getName()))
                .toList();

        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(
                        account.getEmail(),
                        null,
                        grantedAuthorities
                );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authToken);
        SecurityContextHolder.setContext(context);

        HttpSession session = request.getSession(true);
        session.setAttribute(SPRING_SECURITY_CONTEXT_KEY, context);

        return ResponseEntity.ok(account);
    }

    @PostMapping("/register")
    public ResponseEntity<Account> register(@RequestBody RegisterRequest req) {
        Account account = new Account();

        account.setEmail(req.getEmail());
        account.setPassword(req.getPassword());

        String roleName = "ROLE_USER";
        if ("instructor".equalsIgnoreCase(req.getRole())) {
            roleName = "ROLE_ADMIN";
        }

        Set<Authority> authorities = new HashSet<>();
        authorityRepository.findById(roleName).ifPresent(authorities::add);
        account.setAuthorities(authorities);

        String fullName = req.getFullName() != null ? req.getFullName().trim() : "";
        String firstName = fullName;
        String lastName = "";
        int space = fullName.indexOf(' ');
        if (space > 0) {
            firstName = fullName.substring(0, space);
            lastName = fullName.substring(space + 1);
        }

        account.setFirstName(firstName);
        account.setLastName(lastName);

        Account saved = accountService.save(account);


        return ResponseEntity.ok(saved);
    }

    @GetMapping("/me")
    public ResponseEntity<Account> getCurrentUser(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        String email = principal.getName();
        return accountService.findByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Data
    public static class RegisterRequest {
        private String fullName;
        private String email;
        private String password;
        private String role;
        private List<String> classCodes;
    }

    @Data
    public static class AccountRequest {
        private Long id;
        private String fullName;
        private String email;
        private String password;
        private String role;
    }
}