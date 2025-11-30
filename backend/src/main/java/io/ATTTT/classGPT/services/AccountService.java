package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.repositories.AccountRepository;
import io.ATTTT.classGPT.repositories.AuthorityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import java.util.List;


@Service
@RequiredArgsConstructor
public class AccountService {

    private final PasswordEncoder passwordEncoder;
    private final AccountRepository accountRepository;
    private final AuthorityRepository authorityRepository;

    public Account save(Account account) {

        if (account.getId() == null) {
            if (account.getAuthorities().isEmpty()) { //For new Accounts
                Set<Authority> authorities = new HashSet<>();
                authorityRepository.findById("ROLE_USER").ifPresent(authorities::add);
                account.setAuthorities(authorities);
            }

            if (account.getPassword() == null) {
                throw new IllegalArgumentException("Password cannot be null");
            }
            account.setPassword(passwordEncoder.encode(account.getPassword()));

            account.setCreatedAt(LocalDateTime.now());

        }
        else{
            Account existing = accountRepository.findById(account.getId())
                    .orElseThrow();
            if (account.getPassword() == null) {
                account.setPassword(existing.getPassword());
            }
            else if(!account.getPassword().equals(existing.getPassword())){
                account.setPassword(passwordEncoder.encode(account.getPassword()));

            }

        }
        account.setUpdatedAt(LocalDateTime.now());
        return accountRepository.save(account);
    }

    public Optional<Account> findByEmail(String email) {

        List<Account> accounts = accountRepository.findByEmailIgnoreCase(email);

        if (accounts.isEmpty()) {
            return Optional.empty();
        }

        if (accounts.size() > 1) {
            System.out.println(
                    "WARNING: multiple accounts for email " + email + ", picking the first"
            );
        }

        return Optional.of(accounts.get(0));
    }
}