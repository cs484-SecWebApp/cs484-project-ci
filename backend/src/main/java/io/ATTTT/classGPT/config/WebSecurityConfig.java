package io.ATTTT.classGPT.config;

import io.ATTTT.classGPT.security.JwtAuthenticationFilter;
import io.ATTTT.classGPT.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import static org.springframework.security.config.Customizer.withDefaults;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
@RequiredArgsConstructor
public class WebSecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtUtil jwtUtil;

    @Value("${APP_FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public static PasswordEncoder passwordEncoder(){
        return new BCryptPasswordEncoder();
    }


    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(withDefaults())
                .csrf(csrf -> csrf.disable()) // Disable CSRF for JWT
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // Stateless for JWT
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"success\":false,\"message\":\"Unauthorized\"}");
                    response.getWriter().flush();
                }))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                        .requestMatchers("/api/auth/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/logout").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/posts").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/posts/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/statistics").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/posts/*/student-answer").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/posts/*/replies").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/posts/*/LLMReply").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/posts/*/replies/*/flag").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/posts/*/replies/*/endorse").permitAll()
                        .anyRequest().authenticated()
                )

                // login config - returns JSON for API clients
                .formLogin(form -> form
                        .loginProcessingUrl("/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .successHandler((request, response, authentication) -> {
                            response.setStatus(HttpServletResponse.SC_OK);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write("{\"success\":true,\"message\":\"Login successful\"}");
                            response.getWriter().flush();
                        })
                        .failureHandler((request, response, exception) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write("{\"success\":false,\"message\":\"Authentication failed\"}");
                            response.getWriter().flush();
                        })
                        .permitAll()
                )
                // OAuth2 login config
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService)
                        )
                        .successHandler((request, response, authentication) -> {
                            // Generate JWT token for the authenticated user
                            String email = authentication.getName();
                            String jwt = jwtUtil.generateToken(email);
                            
                            System.out.println("OAuth2 Success! User: " + email);
                            System.out.println("Generated JWT token");
                            
                            // Redirect to frontend with JWT token in URL
                            response.sendRedirect(frontendUrl + "/#/?token=" + jwt);
                        })
                        .failureHandler((request, response, exception) -> {
                            // Log the exception for debugging
                            System.err.println("OAuth2 authentication failed: " + exception.getMessage());
                            exception.printStackTrace();
                            // Redirect back to frontend login page with error
                            response.sendRedirect(frontendUrl + "/#/login?error=oauth_failed");
                        })
                )
                // Add JWT filter before username/password authentication filter
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // logout config - returns JSON
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setStatus(HttpServletResponse.SC_OK);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write("{\"success\":true,\"message\":\"Logout successful\"}");
                            response.getWriter().flush();
                        })
                        .permitAll()
                )
                .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        return http.build();
    }

}