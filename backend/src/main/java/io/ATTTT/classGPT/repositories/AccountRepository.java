package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    List<Account> findByAuthorities_Name(String name);
}
