package io.ATTTT.classGPT.repositories;

import io.ATTTT.classGPT.models.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Query("SELECT a FROM Account a WHERE LOWER(a.email) = LOWER(:email)")
    Optional<Account> findByEmail(@Param("email") String email);

    List<Account> findByAuthorities_Name(String name);
}
