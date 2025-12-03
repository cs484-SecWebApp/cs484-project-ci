package io.ATTTT.classGPT.dto;

import java.util.List;

public class AccountDto {
    private Long id;
    private String email;
    private String firstName;
    private String lastName;
    private List<String> roles;

    public AccountDto(Long id, String email, String firstName, String lastName, List<String> roles) {
        this.id = id;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.roles = roles;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public List<String> getRoles() { return roles; }
}
