package io.ATTTT.classGPT.config;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Authority;
import io.ATTTT.classGPT.models.Course;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.repositories.AuthorityRepository;
import io.ATTTT.classGPT.repositories.CourseRepository;
import io.ATTTT.classGPT.services.AccountService;
import io.ATTTT.classGPT.services.PostService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class SeedData implements CommandLineRunner {

    private final PostService postService;
    private final AccountService accountService;
    private final AuthorityRepository authorityRepository;
    private final CourseRepository courseRepo;

    @Override
    public void run(String...args) throws Exception{
        List<Post> posts = postService.getAll();

        if(posts.isEmpty()){

            Authority user = new Authority();
            user.setName("ROLE_USER");
            authorityRepository.save(user);

            Authority admin = new Authority();
            admin.setName("ROLE_ADMIN");
            authorityRepository.save(admin);

            Account account1 = new Account();
            Account account2 = new Account();

            account1.setFirstName("user");
            account1.setLastName("user");
            account1.setEmail("user.user@domain.com");
            account1.setPassword("password");
            Set<Authority> authorities1 = new HashSet<>();
            authorityRepository.findById("ROLE_USER").ifPresent(authorities1::add);
            account1.setAuthorities(authorities1);


            account2.setFirstName("admin");
            account2.setLastName("admin");
            account2.setEmail("admin.admin@domain.com");
            account2.setPassword("password");
            Set<Authority> authorities2 = new HashSet<>();
            authorityRepository.findById("ROLE_USER").ifPresent(authorities2::add);
            authorityRepository.findById("ROLE_ADMIN").ifPresent(authorities2::add);
            account2.setAuthorities(authorities2);

            accountService.save(account1);
            accountService.save(account2);

            Account instructor = account2;

            Course cs484 = new Course();
            cs484.setCode("CS 484");
            cs484.setName("Secure Web Application Development");
            cs484.setTerm("Fall 2025");
            cs484.setOwner(instructor);
            cs484.setJoinCode("DEMO484");
            cs484 = courseRepo.save(cs484);

            Post p1 = new Post();
            p1.setTitle("Welcome to CS 484");
            p1.setBody("Ask your questions here!");
            p1.setAccount(instructor);
            p1.setCourse(cs484);


            Course cs425 = new Course();
            cs425.setCode("CS 425");
            cs425.setName("Computer Graphics");
            cs425.setTerm("Fall 2025");
            cs425.setOwner(instructor);
            cs425.setJoinCode("DEMO425");
            cs425 = courseRepo.save(cs425);

            Post p2 = new Post();
            p2.setTitle("Welcome to CS 425");
            p2.setBody("Ask your questions here!");
            p2.setAccount(instructor);
            p2.setCourse(cs425);

            postService.save(p1);
            postService.save(p2);
        }
    }

}
